/**
 * Stability AI Image Generation Provider
 * Uses Stable Diffusion and other models via Stability AI API
 */

const logger = require('../../utils/logger');

async function generate(options) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('STABILITY_API_KEY not configured');

  const model = process.env.STABILITY_MODEL || 'stable-diffusion-xl-1024-v1-0';

  logger.info(`[Stability] Generating image with model=${model}, ${options.width}x${options.height}`);

  // Stability AI text-to-image endpoint
  const url = `https://api.stability.ai/v1/generation/${model}/text-to-image`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [
        { text: options.prompt, weight: 1 },
      ],
      cfg_scale: 7,
      width: options.width,
      height: options.height,
      steps: 30,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[Stability] API error ${response.status}: ${errorText}`);

    if (response.status === 401) {
      throw new Error('Invalid Stability AI API key. Please check your STABILITY_API_KEY.');
    }
    if (response.status === 402) {
      throw new Error('Stability AI credits exhausted. Please top up your account.');
    }
    if (response.status === 429) {
      throw new Error('Stability AI rate limit exceeded. Please wait and try again.');
    }
    throw new Error(`Stability AI error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const artifacts = data.artifacts || [];

  if (artifacts.length === 0) {
    throw new Error('No image returned from Stability AI');
  }

  const artifact = artifacts[0];

  // Check for content filter
  if (artifact.finishReason === 'CONTENT_FILTERED') {
    throw new Error('Your prompt was filtered by Stability AI\'s safety system. Please modify and try again.');
  }

  // Stability returns base64 encoded images
  const imageUrl = `data:image/png;base64,${artifact.base64}`;

  return {
    url: imageUrl,
    prompt: options.prompt,
    revisedPrompt: null,
  };
}

module.exports = { generate };
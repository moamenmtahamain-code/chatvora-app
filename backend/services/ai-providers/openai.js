/**
 * OpenAI Image Generation Provider
 * Supports DALL·E 3 and GPT Image (gpt-image-1) models
 */

const logger = require('../../utils/logger');

async function generate(options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/images/generations';
  const model = process.env.OPENAI_MODEL || 'dall-e-3';

  logger.info(`[OpenAI] Generating image with model=${model}, size=${options.openaiSize}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      n: 1,
      size: options.openaiSize,
      quality: process.env.OPENAI_QUALITY || 'standard',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[OpenAI] API error ${response.status}: ${errorText}`);

    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env');
    }
    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 400 && errorText.includes('content_policy')) {
      throw new Error('Your prompt was rejected by OpenAI\'s safety filters. Please modify your prompt and try again.');
    }
    throw new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error('No image URL returned from OpenAI');
  }

  return {
    url: imageUrl,
    prompt: options.prompt,
    revisedPrompt: data.data?.[0]?.revised_prompt || null,
  };
}

/**
 * GPT Image generation using gpt-image-1 model
 * Uses the responses API with image generation tool
 */
async function generateGPTImage(options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  logger.info(`[GPT Image] Generating image with gpt-image-1, size=${options.openaiSize}`);

  // GPT Image uses the images/generations endpoint with model gpt-image-1
  const apiUrl = 'https://api.openai.com/v1/images/generations';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: options.prompt,
      n: 1,
      size: options.openaiSize,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[GPT Image] API error ${response.status}: ${errorText}`);

    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env');
    }
    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(`GPT Image API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const imageItem = data.data?.[0];

  // GPT Image may return base64 or URL
  let imageUrl;
  if (imageItem?.url) {
    imageUrl = imageItem.url;
  } else if (imageItem?.b64_json) {
    // Convert base64 to data URL
    imageUrl = `data:image/png;base64,${imageItem.b64_json}`;
  } else {
    throw new Error('No image returned from GPT Image');
  }

  return {
    url: imageUrl,
    prompt: options.prompt,
    revisedPrompt: imageItem?.revised_prompt || null,
  };
}

module.exports = { generate, generateGPTImage };
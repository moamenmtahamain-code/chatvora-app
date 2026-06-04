/**
 * Replicate Image Generation Provider
 * Supports Flux, SDXL, and other open models via Replicate API
 * Uses async polling for long-running generations
 */

const logger = require('../../utils/logger');

const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 2 minutes max
const POLL_INTERVAL = 2000;   // 2 seconds between polls

async function generate(options) {
  const apiKey = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured. Add it to your .env file and restart the server.');

  const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';

  logger.info(`[Replicate] Generating image with model=${model}`);

  // Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: options.prompt,
        num_outputs: 1,
        width: options.width,
        height: options.height,
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    logger.error(`[Replicate] Create prediction error ${createResponse.status}: ${errorText}`);

    if (createResponse.status === 401) {
      throw new Error('Invalid Replicate API key. Please check your REPLICATE_API_KEY.');
    }
    if (createResponse.status === 422) {
      // Model might not support width/height, retry without
      return generateWithMinimalParams(apiKey, model, options);
    }
    if (createResponse.status === 429) {
      throw new Error('Replicate rate limit exceeded. Please wait and try again.');
    }
    throw new Error(`Replicate API error (${createResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const prediction = await createResponse.json();
  logger.info(`[Replicate] Prediction created: ${prediction.id}, status: ${prediction.status}`);

  // If already succeeded (some fast models)
  if (prediction.status === 'succeeded' && prediction.output) {
    const url = extractUrl(prediction.output);
    return { url, prompt: options.prompt, revisedPrompt: null };
  }

  // If failed immediately
  if (prediction.status === 'failed') {
    throw new Error(`Replicate generation failed: ${prediction.error || 'unknown error'}`);
  }

  // Poll for result
  return pollForResult(apiKey, prediction.id, options);
}

async function generateWithMinimalParams(apiKey, model, options) {
  logger.info(`[Replicate] Retrying with minimal params for model=${model}`);

  const createResponse = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: options.prompt,
        num_outputs: 1,
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Replicate API error (${createResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const prediction = await createResponse.json();

  if (prediction.status === 'succeeded' && prediction.output) {
    const url = extractUrl(prediction.output);
    return { url, prompt: options.prompt, revisedPrompt: null };
  }

  if (prediction.status === 'failed') {
    throw new Error(`Replicate generation failed: ${prediction.error || 'unknown error'}`);
  }

  return pollForResult(apiKey, prediction.id, options);
}

async function pollForResult(apiKey, predictionId, options) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL);

    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollResponse.ok) {
      logger.error(`[Replicate] Poll error ${pollResponse.status}`);
      continue; // Retry on transient errors
    }

    const status = await pollResponse.json();
    logger.info(`[Replicate] Poll ${i + 1}/${MAX_POLL_ATTEMPTS}: ${status.status}`);

    if (status.status === 'succeeded' && status.output) {
      const url = extractUrl(status.output);
      return { url, prompt: options.prompt, revisedPrompt: null };
    }

    if (status.status === 'failed') {
      throw new Error(`Replicate generation failed: ${status.error || 'unknown error'}`);
    }

    if (status.status === 'canceled') {
      throw new Error('Replicate generation was canceled');
    }

    // Continue polling for 'starting', 'processing' statuses
  }

  throw new Error('Replicate generation timed out after 2 minutes. Please try again.');
}

function extractUrl(output) {
  if (Array.isArray(output)) {
    return output[0];
  }
  if (typeof output === 'string') {
    return output;
  }
  // Handle FileOutput objects
  if (output?.url) {
    return output.url;
  }
  throw new Error('Could not extract image URL from Replicate output');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { generate };
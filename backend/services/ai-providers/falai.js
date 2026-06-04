/**
 * Fal.ai Image Generation Provider
 * Fast inference for Flux and other models via Fal.ai API
 * Uses queue-based async processing with status polling
 */

const logger = require('../../utils/logger');

const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 2 minutes max
const POLL_INTERVAL = 2000;   // 2 seconds between polls

async function generate(options) {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('FAL_API_KEY not configured');

  const model = process.env.FAL_MODEL || 'fal-ai/flux/schnell';

  logger.info(`[Fal.ai] Generating image with model=${model}`);

  // Submit generation request via queue endpoint
  const submitUrl = `https://queue.fal.run/${model}`;

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      image_size: `${options.width}x${options.height}`,
      num_images: 1,
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    logger.error(`[Fal.ai] Submit error ${submitResponse.status}: ${errorText}`);

    if (submitResponse.status === 401) {
      throw new Error('Invalid Fal.ai API key. Please check your FAL_API_KEY.');
    }
    if (submitResponse.status === 422) {
      // Retry with minimal params (some models don't accept image_size)
      return generateMinimal(apiKey, model, options);
    }
    if (submitResponse.status === 429) {
      throw new Error('Fal.ai rate limit exceeded. Please wait and try again.');
    }
    throw new Error(`Fal.ai API error (${submitResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const submitData = await submitResponse.json();
  const requestId = submitData.request_id;

  if (!requestId) {
    // Some Fal.ai endpoints return results directly (synchronous mode)
    return extractResult(submitData, options);
  }

  logger.info(`[Fal.ai] Request queued: ${requestId}`);

  // Poll for result
  return pollForResult(apiKey, model, requestId, options);
}

async function generateMinimal(apiKey, model, options) {
  logger.info(`[Fal.ai] Retrying with minimal params for model=${model}`);

  const submitUrl = `https://queue.fal.run/${model}`;

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      num_images: 1,
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Fal.ai API error (${submitResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const submitData = await submitResponse.json();
  const requestId = submitData.request_id;

  if (!requestId) {
    return extractResult(submitData, options);
  }

  return pollForResult(apiKey, model, requestId, options);
}

async function pollForResult(apiKey, model, requestId, options) {
  const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL);

    const statusResponse = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${apiKey}` },
    });

    if (!statusResponse.ok) {
      logger.error(`[Fal.ai] Status poll error ${statusResponse.status}`);
      continue;
    }

    const statusData = await statusResponse.json();
    logger.info(`[Fal.ai] Poll ${i + 1}/${MAX_POLL_ATTEMPTS}: ${statusData.status}`);

    if (statusData.status === 'COMPLETED') {
      // Fetch the actual result
      const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;
      const resultResponse = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${apiKey}` },
      });

      if (!resultResponse.ok) {
        throw new Error(`Fal.ai result fetch error (${resultResponse.status})`);
      }

      const resultData = await resultResponse.json();
      return extractResult(resultData, options);
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`Fal.ai generation failed: ${statusData.error || 'unknown error'}`);
    }

    // Continue polling for IN_QUEUE, IN_PROGRESS statuses
  }

  throw new Error('Fal.ai generation timed out after 2 minutes. Please try again.');
}

function extractResult(data, options) {
  // Fal.ai returns images array with url field
  const images = data.images || [];
  if (images.length === 0) {
    throw new Error('No image returned from Fal.ai');
  }

  const imageUrl = images[0].url;

  if (!imageUrl) {
    throw new Error('No image URL in Fal.ai response');
  }

  return {
    url: imageUrl,
    prompt: options.prompt,
    revisedPrompt: null,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { generate };
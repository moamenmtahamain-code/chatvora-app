/**
 * AI Image Provider Registry
 * Manages multiple AI image generation providers with a unified interface.
 */

const logger = require('../../utils/logger');

// ─── Provider configuration registry ────────────────────────────────────────
const PROVIDER_REGISTRY = {
  openai: {
    name: 'OpenAI DALL·E 3',
    envKey: 'OPENAI_API_KEY',
    icon: '🤖',
    description: 'High quality, creative compositions',
    defaultModel: 'dall-e-3',
  },
  'gpt-image': {
    name: 'OpenAI GPT Image',
    envKey: 'OPENAI_API_KEY',
    icon: '🖼️',
    description: 'Latest GPT image generation model',
    defaultModel: 'gpt-image-1',
  },
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    icon: '💎',
    description: 'Google\'s Imagen image generation',
    defaultModel: 'gemini-2.0-flash-exp',
  },
  stability: {
    name: 'Stability AI',
    envKey: 'STABILITY_API_KEY',
    icon: '🎨',
    description: 'Stable Diffusion models',
    defaultModel: 'stable-diffusion-xl-1024-v1-0',
  },
  replicate: {
    name: 'Replicate',
    envKey: 'REPLICATE_API_TOKEN',  // Support REPLICATE_API_TOKEN (also checks REPLICATE_API_KEY)
    altEnvKey: 'REPLICATE_API_KEY',
    icon: '🔄',
    description: 'Flux, SDXL and more open models',
    defaultModel: 'black-forest-labs/flux-schnell',
  },
  falai: {
    name: 'Fal.ai',
    envKey: 'FAL_API_KEY',
    icon: '⚡',
    description: 'Fast inference, Flux models',
    defaultModel: 'fal-ai/flux/schnell',
  },
};

/**
 * Get the API key for a provider (supports alternate env var names)
 */
function getProviderKey(providerId) {
  const reg = PROVIDER_REGISTRY[providerId];
  if (!reg) return null;
  return process.env[reg.envKey] || (reg.altEnvKey ? process.env[reg.altEnvKey] : null) || null;
}

/**
 * Get detailed status of all providers
 */
function getProviderStatus() {
  const statuses = {};
  for (const [id, reg] of Object.entries(PROVIDER_REGISTRY)) {
    const key = getProviderKey(id);
    const isConfigured = !!key && key.length > 5;
    statuses[id] = {
      id,
      name: reg.name,
      icon: reg.icon,
      description: reg.description,
      envKey: reg.envKey,
      configured: isConfigured,
      maskedKey: isConfigured ? key.substring(0, 4) + '***' + key.substring(key.length - 4) : null,
    };
  }
  return statuses;
}

const STYLE_PROMPTS = {
  realistic: 'cinematic, hyper-realistic, DSLR photography, 50mm lens, natural lighting, 8K, ultra detailed, sharp focus',
  fantasy: 'epic fantasy, magical glow, ethereal atmosphere, mythical, dramatic lighting, cinematic, highly detailed',
  cyberpunk: 'cyberpunk, neon lights, rainy streets, futuristic city, holographic displays, vibrant cyan and magenta, ultra detailed',
  anime: 'detailed anime illustration, vibrant colors, cel-shaded, Studio Ghibli inspired, beautiful composition, high quality',
  '3d': 'Octane render, ultra-detailed 3D, soft shadows, ray tracing, PBR materials, isometric, 8K',
  oil_painting: 'oil painting on canvas, thick brushstrokes, rich textures, classical artistry, dramatic chiaroscuro, masterpiece',
  watercolor: 'watercolor painting, soft washes, paper texture, flowing pigments, ethereal, artistic',
  pixel_art: 'pixel art, retro 8-bit, detailed sprites, game art, vibrant palette, crisp pixels',
};

const ASPECT_DIMENSIONS = {
  '1:1':  { width: 1024, height: 1024 },
  '4:3':  { width: 1024, height: 768  },
  '3:4':  { width: 768,  height: 1024 },
  '16:9': { width: 1344, height: 768  },
  '9:16': { width: 768,  height: 1344 },
};

// Provider size compatibility maps
const OPENAI_SIZES = {
  '1:1': '1024x1024',
  '4:3': '1024x1024', // DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
  '3:4': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
};

function buildPrompt(prompt, style) {
  const styleSuffix = STYLE_PROMPTS[style] || '';
  return styleSuffix ? `${prompt}, ${styleSuffix}` : prompt;
}

function getDimensions(aspectRatio) {
  return ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['1:1'];
}

function getOpenAISize(aspectRatio) {
  return OPENAI_SIZES[aspectRatio] || '1024x1024';
}

/**
 * Get list of available providers based on configured API keys
 */
function getAvailableProviders() {
  const providers = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      id: 'openai',
      name: 'OpenAI DALL·E 3',
      description: 'High quality, creative compositions',
      model: process.env.OPENAI_MODEL || 'dall-e-3',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      id: 'gpt-image',
      name: 'OpenAI GPT Image',
      description: 'Latest GPT image generation model',
      model: 'gpt-image-1',
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google\'s Imagen image generation',
      model: 'gemini-2.0-flash-exp',
    });
  }

  if (process.env.STABILITY_API_KEY) {
    providers.push({
      id: 'stability',
      name: 'Stability AI',
      description: 'Stable Diffusion models',
      model: process.env.STABILITY_MODEL || 'stable-diffusion-xl-1024-v1-0',
    });
  }

  if (process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY) {
    providers.push({
      id: 'replicate',
      name: 'Replicate',
      description: 'Flux, SDXL and more open models',
      model: process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell',
    });
  }

  if (process.env.FAL_API_KEY) {
    providers.push({
      id: 'falai',
      name: 'Fal.ai',
      description: 'Fast inference, Flux models',
      model: process.env.FAL_MODEL || 'fal-ai/flux/schnell',
    });
  }

  return providers;
}

/**
 * Generate an image using the specified provider
 */
async function generateImage(providerId, prompt, style, aspectRatio) {
  const enhancedPrompt = buildPrompt(prompt, style);
  const dimensions = getDimensions(aspectRatio);
  const openaiSize = getOpenAISize(aspectRatio);

  const options = {
    prompt: enhancedPrompt,
    originalPrompt: prompt,
    style,
    aspectRatio,
    width: dimensions.width,
    height: dimensions.height,
    openaiSize,
  };

  // Try the selected provider first
  const providers = getAvailableProviders();
  const selectedProvider = providers.find(p => p.id === providerId);

  if (selectedProvider) {
    try {
      const result = await callProvider(providerId, options);
      return { ...result, provider: providerId };
    } catch (err) {
      logger.error(`Provider ${providerId} failed: ${err.message}`);
      // If the selected provider fails, try others as fallback
      throw err;
    }
  }

  // If selected provider is not available, try any available provider
  if (providers.length > 0) {
    logger.info(`Provider ${providerId} not available, falling back to ${providers[0].id}`);
    const result = await callProvider(providers[0].id, options);
    return { ...result, provider: providers[0].id };
  }

  // No providers available — return demo
  const hash = prompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = [1, 20, 42, 73, 99, 123, 256, 404, 512, 777][hash % 10];
  return {
    url: `https://picsum.photos/seed/${seed}/${dimensions.width}/${dimensions.height}`,
    prompt: enhancedPrompt,
    revisedPrompt: null,
    demo: true,
    provider: 'demo',
  };
}

async function callProvider(providerId, options) {
  switch (providerId) {
    case 'openai':
      return require('./openai').generate(options);
    case 'gpt-image':
      return require('./openai').generateGPTImage(options);
    case 'gemini':
      return require('./gemini').generate(options);
    case 'stability':
      return require('./stability').generate(options);
    case 'replicate':
      return require('./replicate').generate(options);
    case 'falai':
      return require('./falai').generate(options);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * Test a provider's API key by making a lightweight request
 */
async function testProviderConnection(providerId) {
  const key = getProviderKey(providerId);
  if (!key) {
    return { success: false, error: `No API key configured for ${providerId}. Set the ${PROVIDER_REGISTRY[providerId]?.envKey || 'API_KEY'} environment variable.` };
  }

  try {
    switch (providerId) {
      case 'openai':
      case 'gpt-image': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) return { success: true, message: 'OpenAI API key is valid and network connection is working.' };
        if (res.status === 401) return { success: false, error: 'Invalid OpenAI API key. Please check your OPENAI_API_KEY.' };
        return { success: false, error: `OpenAI returned status ${res.status}` };
      }
      case 'gemini': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) return { success: true, message: 'Gemini API key is valid and network connection is working.' };
        if (res.status === 400 || res.status === 403) return { success: false, error: 'Invalid Gemini API key. Please check your GEMINI_API_KEY.' };
        return { success: false, error: `Gemini returned status ${res.status}` };
      }
      case 'stability': {
        const res = await fetch('https://api.stability.ai/v1/user/account', {
          headers: { 'Authorization': `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) return { success: true, message: 'Stability AI API key is valid and network connection is working.' };
        if (res.status === 401) return { success: false, error: 'Invalid Stability AI API key. Please check your STABILITY_API_KEY.' };
        return { success: false, error: `Stability AI returned status ${res.status}` };
      }
      case 'replicate': {
        const res = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'HEAD',
          headers: { 'Authorization': `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 401) return { success: false, error: 'Invalid Replicate API token. Please check your REPLICATE_API_TOKEN.' };
        // 200 or 403 or 405 all mean auth worked
        return { success: true, message: 'Replicate API token is valid and network connection is working.' };
      }
      case 'falai': {
        // fal.ai doesn't have a simple validate endpoint, so we just check the key format
        if (key.length > 10) return { success: true, message: 'Fal.ai API key is configured. Connection will be verified on first generation.' };
        return { success: false, error: 'Fal.ai API key appears too short. Please check your FAL_API_KEY.' };
      }
      default:
        return { success: false, error: `Unknown provider: ${providerId}` };
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
      return { success: false, error: `Connection timed out. Check your internet connection and try again.` };
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { success: false, error: `Network error: Could not reach ${providerId} servers. Check your internet connection.` };
    }
    return { success: false, error: `Connection test failed: ${err.message}` };
  }
}

module.exports = {
  getAvailableProviders,
  generateImage,
  getProviderStatus,
  getProviderKey,
  testProviderConnection,
  PROVIDER_REGISTRY,
  STYLE_PROMPTS,
  ASPECT_DIMENSIONS,
};

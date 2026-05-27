const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getDb } = require('../database/database');
const { ObjectId } = require('mongodb');

const DEMO_SEEDS = [1, 20, 42, 73, 99, 123, 256, 404, 512, 777];

const getPlaceholderUrl = (prompt) => {
  const hash = prompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = DEMO_SEEDS[hash % DEMO_SEEDS.length];
  return `https://picsum.photos/seed/${seed}/600/400`;
};

const STYLES = {
  realistic: 'cinematic, hyper-realistic, DSLR photography, 50mm lens, natural lighting, 8K',
  fantasy: 'epic fantasy, magical glow, ethereal atmosphere, mythical, dramatic lighting, cinematic',
  cyberpunk: 'cyberpunk, neon lights, rainy streets, futuristic city, holographic displays, vibrant cyan and magenta',
  anime: 'detailed anime illustration, vibrant colors, cel-shaded, Studio Ghibli inspired, beautiful composition',
  '3d': 'Octane render, ultra-detailed 3D, soft shadows, ray tracing, PBR materials, isometric',
  oil_painting: 'oil painting on canvas, thick brushstrokes, rich textures, classical artistry, dramatic chiaroscuro',
  watercolor: 'watercolor painting, soft washes, paper texture, flowing pigments, ethereal',
  pixel_art: 'pixel art, retro 8-bit, detailed sprites, game art, vibrant palette, crisp pixels',
};

async function safeJsonParse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    logger.error('Failed to parse response as JSON. Raw text (first 200 chars):', text.substring(0, 200));
    throw new Error('External API returned invalid JSON. Status: ' + res.status);
  }
}

router.post('/generate-image', auth, async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const styleSuffix = STYLES[style] || '';
    const enhancedPrompt = styleSuffix ? `${prompt}, ${styleSuffix}` : prompt;

    const replicateKey = process.env.REPLICATE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (replicateKey) {
      try {
        const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';
        const apiResponse = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + replicateKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: { prompt: enhancedPrompt, num_outputs: 1 } })
        });

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          logger.error('Replicate API error:', apiResponse.status, errText);
          throw new Error('Replicate API returned status ' + apiResponse.status);
        }

        const prediction = await safeJsonParse(apiResponse);

        if (prediction.status === 'succeeded' && prediction.output) {
          const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          return res.json({ url, prompt: enhancedPrompt, revisedPrompt: null, provider: 'replicate' });
        }

        if (prediction.status === 'processing' || prediction.status === 'starting') {
          const maxAttempts = 30;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const pollRes = await fetch('https://api.replicate.com/v1/predictions/' + prediction.id, {
              headers: { 'Authorization': 'Bearer ' + replicateKey }
            });
            const statusData = await safeJsonParse(pollRes);
            if (statusData.status === 'succeeded' && statusData.output) {
              const url = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
              return res.json({ url, prompt: enhancedPrompt, revisedPrompt: null, provider: 'replicate' });
            }
            if (statusData.status === 'failed') {
              throw new Error('Replicate generation failed: ' + (statusData.error || 'unknown error'));
            }
          }
          throw new Error('Replicate generation timed out');
        }

        throw new Error('Unexpected Replicate response status: ' + prediction.status);
      } catch (apiErr) {
        logger.error('Replicate API call failed:', apiErr.message);
        throw apiErr;
      }
    }

    if (openaiKey) {
      try {
        const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/images/generations';
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + openaiKey
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL || 'dall-e-3',
            prompt: enhancedPrompt,
            n: 1,
            size: process.env.AI_IMAGE_SIZE || '1024x1024',
            quality: process.env.AI_QUALITY || 'standard'
          })
        });

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          logger.error('OpenAI API error:', apiResponse.status, errText);
          if (apiResponse.status === 401) {
            return res.status(500).json({ message: 'Invalid OpenAI API key', error: 'Unauthorized' });
          }
          return res.status(apiResponse.status).json({ message: 'Image generation failed', error: errText });
        }

        const data = await safeJsonParse(apiResponse);
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) {
          return res.status(500).json({ message: 'No image returned from AI service' });
        }

        return res.json({
          url: imageUrl,
          prompt: enhancedPrompt,
          revisedPrompt: data.data?.[0]?.revised_prompt || null,
          provider: 'openai'
        });
      } catch (apiErr) {
        logger.error('OpenAI API call failed:', apiErr.message);
        throw apiErr;
      }
    }

    return res.json({
      url: getPlaceholderUrl(prompt),
      prompt: enhancedPrompt,
      revisedPrompt: null,
      demo: true,
      message: 'Set REPLICATE_API_KEY or OPENAI_API_KEY in .env for real AI images.'
    });
  } catch (error) {
    logger.error('AI image generation error:', error);
    res.status(500).json({ message: 'Failed to generate image', error: error.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const db = getDb();
    const generations = await db.collection('ai_generations')
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json(generations);
  } catch (error) {
    logger.error('AI history error:', error);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

router.post('/save', auth, async (req, res) => {
  try {
    const { prompt, url, style } = req.body;
    if (!prompt || !url) {
      return res.status(400).json({ message: 'Prompt and URL are required' });
    }
    const db = getDb();
    const doc = {
      userId: req.user._id,
      prompt,
      url,
      style: style || 'realistic',
      createdAt: new Date()
    };
    const result = await db.collection('ai_generations').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (error) {
    logger.error('AI save error:', error);
    res.status(500).json({ message: 'Failed to save generation' });
  }
});

router.delete('/history/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db.collection('ai_generations').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id
    });
    res.json({ message: 'Deleted' });
  } catch (error) {
    logger.error('AI delete error:', error);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

module.exports = router;

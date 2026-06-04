const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getDb } = require('../database/database');
const { ObjectId } = require('mongodb');
const { getAvailableProviders, generateImage, getProviderStatus, testProviderConnection, PROVIDER_REGISTRY } = require('../services/ai-providers');

// Path to .env file
const envPath = path.join(__dirname, '..', '.env');

// Helper: set a single env var in .env file and in process.env at runtime
function setEnvVar(key, value) {
  let envContent = '';
  try { envContent = fs.readFileSync(envPath, 'utf8'); } catch (_) { /* file may not exist yet */ }
  const lines = envContent.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && match[1].trim() === key) { found = true; return `${key}=${value}`; }
    return line;
  });
  if (!found) newLines.push(`${key}=${value}`);
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
  process.env[key] = value;
}

// ─── GET AVAILABLE PROVIDERS ─────────────────────────────────────────────────
router.get('/providers', auth, (req, res) => {
  try {
    const providers = getAvailableProviders();
    const providerStatus = getProviderStatus();
    const defaultProvider = process.env.AI_DEFAULT_PROVIDER || providers[0]?.id || 'openai';
    const configuredCount = Object.values(providerStatus).filter(p => p.configured).length;
    res.json({
      providers,
      defaultProvider,
      demo: providers.length === 0,
      providerStatus,
      configuredCount,
      totalCount: Object.keys(providerStatus).length,
    });
  } catch (error) {
    logger.error('AI providers list error:', error);
    res.status(500).json({ message: 'Failed to list providers' });
  }
});

// ─── GET PROVIDER STATUS ─────────────────────────────────────────────────────
router.get('/provider-status', auth, (req, res) => {
  try {
    const providerStatus = getProviderStatus();
    const configuredCount = Object.values(providerStatus).filter(p => p.configured).length;
    const providers = getAvailableProviders();
    res.json({
      providers: providerStatus,
      configuredCount,
      totalCount: Object.keys(providerStatus).length,
      hasAnyProvider: configuredCount > 0,
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || providers[0]?.id || null,
      envExample: {
        OPENAI_API_KEY: 'sk-...your-openai-key',
        GEMINI_API_KEY: 'AI...your-gemini-key',
        STABILITY_API_KEY: 'sk-...your-stability-key',
        REPLICATE_API_TOKEN: 'r8_...your-replicate-token',
      },
    });
  } catch (error) {
    logger.error('Provider status error:', error);
    res.status(500).json({ message: 'Failed to get provider status' });
  }
});

// ─── TEST PROVIDER CONNECTION ────────────────────────────────────────────────
router.post('/test-connection', auth, async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ message: 'Provider ID is required' });
    }
    if (!PROVIDER_REGISTRY[provider]) {
      return res.status(400).json({ message: `Unknown provider: ${provider}` });
    }
    const result = await testProviderConnection(provider);
    res.json(result);
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ success: false, error: 'Connection test failed: ' + error.message });
  }
});

// ─── GENERATE IMAGE ──────────────────────────────────────────────────────────
router.post('/generate-image', auth, async (req, res) => {
  try {
    const { prompt, style, aspectRatio, provider: requestedProvider } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const selectedProvider = requestedProvider || process.env.AI_DEFAULT_PROVIDER || 'openai';
    const selectedStyle = style || 'realistic';
    const selectedAspect = aspectRatio || '1:1';

    logger.info(`[AI] Generate request: provider=${selectedProvider}, style=${selectedStyle}, aspect=${selectedAspect}, prompt="${prompt.substring(0, 80)}..."`);

    const result = await generateImage(selectedProvider, prompt.trim(), selectedStyle, selectedAspect);

    return res.json({
      url: result.url,
      prompt: result.prompt,
      revisedPrompt: result.revisedPrompt || null,
      provider: result.provider,
      demo: !!result.demo,
      style: selectedStyle,
      aspectRatio: selectedAspect,
    });
  } catch (error) {
    logger.error('AI image generation error:', error);

    // Friendly error messages
    let statusCode = 500;
    let message = error.message || 'Failed to generate image';

    if (message.includes('rate limit') || message.includes('429')) {
      statusCode = 429;
    } else if (message.includes('Invalid') && message.includes('API key')) {
      statusCode = 401;
    } else if (message.includes('safety') || message.includes('filtered') || message.includes('content_policy')) {
      statusCode = 400;
    }

    res.status(statusCode).json({ message, error: error.message });
  }
});

// ─── GET GENERATION HISTORY ──────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const generations = await db.collection('ai_generations')
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.json(generations);
  } catch (error) {
    logger.error('AI history error:', error);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

// ─── SAVE GENERATION ─────────────────────────────────────────────────────────
router.post('/save', auth, async (req, res) => {
  try {
    const { prompt, url, style, aspectRatio, provider } = req.body;
    if (!prompt || !url) {
      return res.status(400).json({ message: 'Prompt and URL are required' });
    }
    const db = getDb();
    const doc = {
      userId: req.user._id,
      prompt,
      url,
      style: style || 'realistic',
      aspectRatio: aspectRatio || '1:1',
      provider: provider || 'unknown',
      createdAt: new Date(),
    };
    const result = await db.collection('ai_generations').insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (error) {
    logger.error('AI save error:', error);
    res.status(500).json({ message: 'Failed to save generation' });
  }
});

// ─── DELETE GENERATION ───────────────────────────────────────────────────────
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db.collection('ai_generations').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id,
    });
    res.json({ message: 'Deleted' });
  } catch (error) {
    logger.error('AI delete error:', error);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

// ─── SAVE API KEYS ───────────────────────────────────────────────────────────
router.post('/save-keys', auth, async (req, res) => {
  try {
    const { openai, gemini, stability, replicate } = req.body;
    if (openai) setEnvVar('OPENAI_API_KEY', openai);
    if (gemini) setEnvVar('GEMINI_API_KEY', gemini);
    if (stability) setEnvVar('STABILITY_API_KEY', stability);
    if (replicate) setEnvVar('REPLICATE_API_TOKEN', replicate);
    logger.info('[AI] API keys saved to .env');
    res.json({ success: true, message: 'API keys saved successfully.' });
  } catch (error) {
    logger.error('Save keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to save API keys: ' + error.message });
  }
});

// ─── TRANSLATE MESSAGE ───────────────────────────────────────────────────────
router.post('/translate', auth, async (req, res) => {
  try {
    const { text, targetLanguage = 'en' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // Try LibreTranslate (free, no key required for small usage)
    try {
      const response = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetLanguage,
          format: 'text',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translatedText) {
          return res.json({ translatedText: data.translatedText, provider: 'libre' });
        }
      }
    } catch (_) {
      // Fallback to Google's unofficial translate API
      try {
        const langResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`
        );
        if (langResponse.ok) {
          const langData = await langResponse.json();
          const translated = langData[0]?.map(s => s[0]).filter(Boolean).join('');
          if (translated) {
            return res.json({ translatedText: translated, provider: 'google' });
          }
        }
      } catch (_2) {}
    }

    return res.status(503).json({ message: 'Translation service unavailable' });
  } catch (error) {
    logger.error('Translation error:', error);
    res.status(500).json({ message: 'Translation failed' });
  }
});

module.exports = router;
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIStore, PRESET_STYLES } from '../../stores/aiStore';
import { aiAPI } from '../../lib/api';

const ENHANCE_TIPS = [
  'Add cinematic lighting and dramatic shadows',
  'Describe camera lens, focal length, and depth of field',
  'Include colors, textures, and atmospheric details',
  'Specify the mood — serene, epic, mysterious, vibrant',
  'Add quality tags: 4K, ultra-detailed, sharp focus',
];

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) { setLoading(false); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
    } catch { }
    setLoading(false);
  }, []);
  return { user, loading };
}

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', width: 1024, height: 1024 },
  { id: '4:3', label: 'Landscape', width: 1024, height: 768 },
  { id: '3:4', label: 'Portrait', width: 768, height: 1024 },
  { id: '16:9', label: 'Wide', width: 1216, height: 832 },
  { id: '9:16', label: 'Story', width: 832, height: 1216 },
];

const PROVIDER_ICONS = {
  openai: '🤖',
  'gpt-image': '🖼️',
  gemini: '💎',
  stability: '🎨',
  replicate: '🔄',
  falai: '⚡',
};

// ─── Setup Provider Data ────────────────────────────────────────────────────
const SETUP_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    color: '#10a37f',
    colorLight: 'rgba(16,163,127,0.12)',
    description: 'Industry-leading AI with DALL·E image generation. Best quality and reliability.',
    pricing: '$0.04 – $0.12 per image',
    difficulty: '🟢 Easy',
    website: 'https://platform.openai.com',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    envKey: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '💎',
    color: '#4285f4',
    colorLight: 'rgba(66,133,244,0.12)',
    description: 'Google\'s powerful AI model. Great quality with generous free tier.',
    pricing: 'Free tier available, then pay-per-use',
    difficulty: '🟢 Easy',
    website: 'https://ai.google.dev',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    envKey: 'GEMINI_API_KEY',
    placeholder: 'AI...',
  },
  {
    id: 'stability',
    name: 'Stability AI',
    icon: '🎨',
    color: '#a855f7',
    colorLight: 'rgba(168,85,247,0.12)',
    description: 'Specialized in image generation with Stable Diffusion. Highly customizable.',
    pricing: '$0.003 – $0.03 per image',
    difficulty: '🟡 Medium',
    website: 'https://stability.ai',
    getKeyUrl: 'https://platform.stability.ai/account/keys',
    envKey: 'STABILITY_API_KEY',
    placeholder: 'sk-...',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    icon: '🔄',
    color: '#f97316',
    colorLight: 'rgba(249,115,22,0.12)',
    description: 'Run any AI model in the cloud. Access to thousands of community models.',
    pricing: 'Pay per second of compute time',
    difficulty: '🟡 Medium',
    website: 'https://replicate.com',
    getKeyUrl: 'https://replicate.com/account/api-tokens',
    envKey: 'REPLICATE_API_TOKEN',
    placeholder: 'r8_...',
  },
];

const SETUP_STEPS = [
  { num: 1, label: 'Choose Provider', icon: '👆' },
  { num: 2, label: 'Get API Key', icon: '🔑' },
  { num: 3, label: 'Paste Key', icon: '📋' },
  { num: 4, label: 'Test Connection', icon: '🔌' },
  { num: 5, label: 'Generate Images', icon: '🎨' },
];

// ─── Provider Card for Setup ────────────────────────────────────────────────
function ProviderSetupCard({ provider, isConnected, onSelect, isSelected }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(provider.id)}
      style={{
        background: isSelected ? provider.colorLight : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? provider.color + '40' : isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16, padding: '20px 20px 16px',
        cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
      }}
    >
      {isConnected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(34,197,94,0.15)', color: '#6ee7b7',
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        }}>✅ Connected</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: provider.colorLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>{provider.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>{provider.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{provider.difficulty}</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>{provider.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 11, color: provider.color, fontWeight: 600,
          background: provider.colorLight, padding: '4px 10px', borderRadius: 8,
        }}>{provider.pricing}</span>
        <a href={provider.website} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: '#64748b', textDecoration: 'none' }}>
          Visit website ↗
        </a>
      </div>
    </motion.div>
  );
}

// ─── API Key Input Form ─────────────────────────────────────────────────────
function APIKeyForm({ provider, onTest, testResult, isTesting, onSave, saving }) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  if (!provider) return null;

  const handleSave = async () => {
    if (!key.trim()) return;
    await onSave(provider.id, key.trim());
    setKey('');
  };

  const handleTest = async () => {
    if (!key.trim()) return;
    await onTest(provider.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 24, marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>{provider.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{provider.name} API Key</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Your key is saved securely and never shared
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={provider.placeholder}
          style={{
            width: '100%', padding: '14px 100px 14px 16px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, color: '#e2e8f0', fontSize: 14,
            fontFamily: 'monospace', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
          <button onClick={() => setShowKey(!showKey)} style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit',
          }}>{showKey ? '🙈 Hide' : '👁 Show'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer" style={{
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: provider.colorLight, border: `1px solid ${provider.color}30`,
          color: provider.color, textDecoration: 'none', display: 'inline-flex',
          alignItems: 'center', gap: 6,
        }}>🔑 Get API Key ↗</a>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Sign up at {provider.name} to get your key
        </span>
      </div>

      {testResult && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontSize: 13, fontWeight: 500,
            color: testResult.success ? '#6ee7b7' : '#fca5a5',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {testResult.success ? '✅ Connected successfully!' : `❌ ${testResult.error || 'Connection failed'}`}
        </motion.div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSave} disabled={!key.trim() || saving} style={{
          flex: 1, padding: '12px 20px', borderRadius: 12,
          background: key.trim() ? `linear-gradient(135deg, ${provider.color}, ${provider.color}cc)` : 'rgba(255,255,255,0.05)',
          border: 'none', color: key.trim() ? 'white' : '#64748b',
          fontSize: 14, fontWeight: 600, cursor: key.trim() ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', transition: 'all 0.2s',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? '💾 Saving...' : '💾 Save Key'}
        </button>
        <button onClick={handleTest} disabled={isTesting} style={{
          padding: '12px 20px', borderRadius: 12,
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
          color: '#a78bfa', fontSize: 14, fontWeight: 600,
          cursor: isTesting ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {isTesting ? '⟳ Testing...' : '🔌 Test'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Success Screen ──────────────────────────────────────────────────────────
function SuccessScreen({ provider, onContinue }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        textAlign: 'center', padding: '48px 24px',
        background: 'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, transparent 100%)',
        borderRadius: 20,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.6 }}
        style={{ fontSize: 64, marginBottom: 20 }}
      >🎉</motion.div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg, #6ee7b7, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        AI Studio Ready!
      </h2>
      <p style={{ fontSize: 15, color: '#94a3b8', marginBottom: 8 }}>
        {provider?.name || 'Your provider'} is connected and ready to generate images.
      </p>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 32 }}>
        You can now create stunning AI-generated images.
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        style={{
          padding: '14px 36px', borderRadius: 14,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', color: 'white', fontSize: 16, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
        }}
      >
        🎨 Start Creating Images
      </motion.button>
    </motion.div>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 32 }}>
      {SETUP_STEPS.map((step, i) => (
        <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              background: currentStep >= step.num ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)',
              border: currentStep >= step.num ? 'none' : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.3s',
            }}>
              {currentStep > step.num ? '✓' : step.icon}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: currentStep >= step.num ? '#a78bfa' : '#475569',
              textAlign: 'center', maxWidth: 64,
            }}>{step.label}</span>
          </div>
          {i < SETUP_STEPS.length - 1 && (
            <div style={{
              width: 24, height: 2, borderRadius: 1,
              background: currentStep > step.num ? '#6366f1' : 'rgba(255,255,255,0.06)',
              marginTop: -14, transition: 'all 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function AIPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    currentPrompt, selectedStyle, selectedProvider, aspectRatio,
    isGenerating, currentImage, history, error, providers, isDemoMode,
    providerStatus, testingProvider, testResults,
    setPrompt, setStyle, setProvider, setAspectRatio,
    generate, saveGeneration, fetchHistory, deleteFromHistory, clearCurrent,
    fetchProviders, testConnection,
  } = useAIStore();

  const [showTips, setShowTips] = useState(false);
  const [enhanceText, setEnhanceText] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [activeTab, setActiveTab] = useState('setup');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [selectedSetupProvider, setSelectedSetupProvider] = useState(null);
  const [setupStep, setSetupStep] = useState(1); // 1=choose, 2=key, 3=success
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState(null);
  const inputRef = useRef(null);
  const providerDropdownRef = useRef(null);

  const hasProviders = providers.length > 0;
  const providerStatusList = Object.values(providerStatus);

  useEffect(() => {
    if (user) {
      fetchProviders();
      fetchHistory();
    }
  }, [user, fetchProviders, fetchHistory]);

  // Auto-switch to create tab when providers become available
  useEffect(() => {
    if (hasProviders && activeTab === 'setup') {
      // Stay on setup but allow navigation to create
    }
  }, [hasProviders, activeTab]);

  useEffect(() => {
    const handler = (e) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentPrompt.trim() || isGenerating) return;
    const result = await generate(currentPrompt, selectedStyle, aspectRatio, selectedProvider);
    if (result?.url && !result.demo) {
      await saveGeneration(currentPrompt, result.url, selectedStyle, aspectRatio, selectedProvider);
      setSavedId(Date.now().toString());
      setTimeout(() => setSavedId(null), 2000);
    }
  }, [currentPrompt, isGenerating, aspectRatio, selectedStyle, selectedProvider, generate, saveGeneration]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
  }, [handleGenerate]);

  const handleEnhance = useCallback(() => {
    const tip = ENHANCE_TIPS[Math.floor(Math.random() * ENHANCE_TIPS.length)];
    setEnhanceText(tip);
    setTimeout(() => setEnhanceText(''), 3000);
  }, []);

  const copyToClipboard = useCallback((text) => { navigator.clipboard.writeText(text); }, []);

  const handleTestConnection = useCallback(async (providerId) => {
    await testConnection(providerId);
  }, [testConnection]);

  const handleSaveKey = useCallback(async (providerId, keyValue) => {
    setSaving(true);
    try {
      const keyMap = { openai: 'openai', gemini: 'gemini', stability: 'stability', replicate: 'replicate' };
      await aiAPI.saveKeys({ [keyMap[providerId]]: keyValue });
      await fetchProviders();
      // Check if now connected
      const updatedStatus = useAIStore.getState().providerStatus;
      if (updatedStatus[providerId]?.configured) {
        setConnectedProvider(SETUP_PROVIDERS.find(p => p.id === providerId));
        setShowSuccess(true);
        setSetupStep(3);
      }
    } catch (err) {
      console.error('Failed to save key:', err);
    }
    setSaving(false);
  }, [fetchProviders]);

  const handleSelectSetupProvider = useCallback((id) => {
    setSelectedSetupProvider(SETUP_PROVIDERS.find(p => p.id === id));
    setSetupStep(2);
  }, []);

  const handleTestAndFinish = useCallback(async (providerId) => {
    await testConnection(providerId);
    const updatedStatus = useAIStore.getState().providerStatus;
    if (updatedStatus[providerId]?.configured) {
      const prov = SETUP_PROVIDERS.find(p => p.id === providerId);
      setConnectedProvider(prov);
      setShowSuccess(true);
      setSetupStep(3);
    }
  }, [testConnection]);

  const currentProviderObj = providers.find(p => p.id === selectedProvider);

  // Determine the effective step for the indicator
  const effectiveStep = hasProviders ? 5 : setupStep;

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07050f' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07050f', color: '#e2e8f0', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✨</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>AI Image Studio</h1>
        <p style={{ color: '#94a3b8', marginBottom: 24, textAlign: 'center' }}>Sign in to generate stunning AI images from text prompts.</p>
        <a href="/login" style={{ padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, textDecoration: 'none' }}>Sign In</a>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(-100px) rotate(360deg); opacity: 0; } }
        .ai-fade-in { animation: fadeIn 0.3s ease; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .gallery-card:hover .gallery-overlay { opacity: 1; }
        .gallery-card:hover img { transform: scale(1.05); }
        textarea:focus { border-color: rgba(99,102,241,0.4) !important; }
        .overlay-btn:hover { background: rgba(255,255,255,0.25) !important; }
        .action-btn:hover { background: rgba(255,255,255,0.1) !important; }
        .style-chip:hover, .aspect-chip:hover { border-color: rgba(99,102,241,0.25) !important; }
        .generate-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
        .provider-option:hover { background: rgba(99,102,241,0.08) !important; }
        .setup-card:hover { border-color: rgba(99,102,241,0.2) !important; }
      `}</style>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.navLeft}>
            <a href="/" style={styles.backBtn}>←</a>
            <div style={styles.brandIcon}>✨</div>
            <span style={styles.brandText}>AI Studio</span>
            {hasProviders && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#6ee7b7',
                background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: 20,
                border: '1px solid rgba(34,197,94,0.15)',
              }}>✅ Ready</span>
            )}
          </div>
          <div style={styles.navTabs}>
            {!hasProviders && (
              <button onClick={() => setActiveTab('setup')} style={{ ...styles.navTab, ...(activeTab === 'setup' ? styles.navTabActive : {}) }}>
                🔧 Setup
              </button>
            )}
            <button onClick={() => setActiveTab('create')} style={{ ...styles.navTab, ...(activeTab === 'create' ? styles.navTabActive : {}) }}>
              🎨 Create
            </button>
            <button onClick={() => { setActiveTab('gallery'); fetchHistory(); }} style={{ ...styles.navTab, ...(activeTab === 'gallery' ? styles.navTabActive : {}) }}>
              🖼️ Gallery {history.length > 0 && <span style={styles.badge}>{history.length}</span>}
            </button>
            <button onClick={() => setActiveTab('providers')} style={{ ...styles.navTab, ...(activeTab === 'providers' ? styles.navTabActive : {}) }}>
              ⚡ Providers
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.main}>
        {/* ─── SETUP TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'setup' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Welcome Hero */}
            {!showSuccess && (
              <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 16 }}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, background: 'linear-gradient(135deg, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Welcome to AI Studio
                  </h1>
                  <p style={{ fontSize: 15, color: '#94a3b8', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
                    Choose an AI provider below to start generating incredible images.
                    It only takes a minute to set up.
                  </p>
                </motion.div>
              </div>
            )}

            {/* Step Indicator */}
            <StepIndicator currentStep={effectiveStep} />

            {/* Success Screen */}
            {showSuccess && connectedProvider ? (
              <SuccessScreen
                provider={connectedProvider}
                onContinue={() => { setActiveTab('create'); setShowSuccess(false); }}
              />
            ) : (
              <AnimatePresence mode="wait">
                {/* Step 1: Choose Provider */}
                {setupStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
                      Choose Your AI Provider
                    </h3>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                      gap: 14,
                    }}>
                      {SETUP_PROVIDERS.map((p) => (
                        <ProviderSetupCard
                          key={p.id}
                          provider={p}
                          isConnected={providerStatus[p.id]?.configured}
                          onSelect={handleSelectSetupProvider}
                          isSelected={selectedSetupProvider?.id === p.id}
                        />
                      ))}
                    </div>

                    {/* Demo Mode Banner */}
                    <div style={{
                      marginTop: 24, padding: '16px 20px', borderRadius: 14,
                      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
                      textAlign: 'center',
                    }}>
                      <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>
                        💡 Want to try first? You can explore the interface in{' '}
                      </span>
                      <button onClick={() => setActiveTab('create')} style={{
                        background: 'none', border: 'none', color: '#f59e0b',
                        cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        textDecoration: 'underline', fontFamily: 'inherit',
                      }}>Demo Mode</button>
                      <span style={{ fontSize: 13, color: '#f59e0b' }}> without an API key.</span>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Enter API Key */}
                {setupStep === 2 && selectedSetupProvider && (
                  <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <button onClick={() => { setSetupStep(1); setSelectedSetupProvider(null); }} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 13,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit',
                      }}>← Back</button>
                      <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                        Set up {selectedSetupProvider.name}
                      </h3>
                    </div>

                    <APIKeyForm
                      provider={selectedSetupProvider}
                      onTest={handleTestAndFinish}
                      testResult={testResults[selectedSetupProvider.id]}
                      isTesting={testingProvider === selectedSetupProvider.id}
                      onSave={handleSaveKey}
                      saving={saving}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ─── CREATE TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'create' && (
          <div style={styles.createLayout}>
            <div style={styles.leftPanel}>
              {/* Demo Mode Banner */}
              {isDemoMode && (
                <div style={{
                  padding: '12px 16px', background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12,
                  fontSize: 13, color: '#f59e0b', lineHeight: 1.5,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>Demo Mode</span> — You're exploring without an API key.
                    <button onClick={() => setActiveTab('setup')} style={{
                      background: 'none', border: 'none', color: '#f59e0b',
                      cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
                      textDecoration: 'underline', fontSize: 13, marginLeft: 4,
                    }}>Set up a provider →</button>
                  </div>
                </div>
              )}

              {/* No Providers Banner */}
              {!hasProviders && !isDemoMode && (
                <div style={{
                  padding: '14px 16px', background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12,
                  fontSize: 13, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span style={{ flex: 1 }}>No providers configured yet. Set one up to start creating.</span>
                  <button onClick={() => setActiveTab('setup')} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12,
                    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}>Setup →</button>
                </div>
              )}

              {/* Provider Selector */}
              <div style={styles.providerSection}>
                <label style={styles.label}>AI Provider</label>
                <div style={styles.providerSelector} ref={providerDropdownRef}>
                  <button onClick={() => setShowProviderDropdown(!showProviderDropdown)} style={styles.providerButton}>
                    <span style={styles.providerIcon}>{PROVIDER_ICONS[selectedProvider] || '🤖'}</span>
                    <span style={styles.providerName}>{currentProviderObj?.name || 'Select Provider'}</span>
                    <span style={styles.providerChevron}>{showProviderDropdown ? '▲' : '▼'}</span>
                  </button>
                  {showProviderDropdown && (
                    <div style={styles.providerDropdown}>
                      {providers.length > 0 ? providers.map((p) => (
                        <button key={p.id}
                          onClick={() => { setProvider(p.id); setShowProviderDropdown(false); }}
                          style={{ ...styles.providerOption, ...(selectedProvider === p.id ? styles.providerOptionActive : {}) }}
                          className="provider-option"
                        >
                          <span style={{ fontSize: 18 }}>{PROVIDER_ICONS[p.id] || '🤖'}</span>
                          <div style={styles.providerOptionInfo}>
                            <div style={styles.providerOptionName}>{p.name}</div>
                            <div style={styles.providerOptionDesc}>{p.description}</div>
                          </div>
                          {selectedProvider === p.id && <span style={{ color: '#6366f1', marginLeft: 'auto' }}>✓</span>}
                        </button>
                      )) : (
                        <div style={styles.noProviders}>
                          <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>No providers configured yet</p>
                          <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Set up a provider to start generating images.</p>
                          <button onClick={() => { setActiveTab('setup'); setShowProviderDropdown(false); }} style={{
                            marginTop: 10, padding: '8px 16px', borderRadius: 8, fontSize: 13,
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                            color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                          }}>⚡ Setup Provider</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.inputSection}>
                <label style={styles.label}>Prompt</label>
                <div style={styles.inputWrapper}>
                  <textarea ref={inputRef} value={currentPrompt} onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown} placeholder="Describe the image you want to create..."
                    style={styles.textarea} rows={4} />
                  <button onClick={handleEnhance} style={styles.enhanceBtn} title="Get a prompt tip">✨</button>
                </div>
                {enhanceText && <div style={styles.tipBox}>💡 {enhanceText}</div>}
              </div>

              <div style={styles.styleSection}>
                <label style={styles.label}>Style</label>
                <div style={styles.styleGrid}>
                  {PRESET_STYLES.map((s) => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      style={{ ...styles.styleChip, ...(selectedStyle === s.id ? styles.styleChipActive : {}) }}
                      className="style-chip">
                      <span>{s.icon}</span><span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.aspectSection}>
                <label style={styles.label}>Aspect Ratio</label>
                <div style={styles.aspectGrid}>
                  {ASPECT_RATIOS.map((r) => (
                    <button key={r.id} onClick={() => setAspectRatio(r.id)}
                      style={{ ...styles.aspectChip, ...(aspectRatio === r.id ? styles.aspectChipActive : {}) }}
                      className="aspect-chip">
                      {r.label}<span style={styles.aspectDim}>{r.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleGenerate} disabled={isGenerating || !currentPrompt.trim()}
                style={{ ...styles.generateBtn, ...((isGenerating || !currentPrompt.trim()) ? styles.generateBtnDisabled : {}) }}
                className="generate-btn">
                {isGenerating ? (
                  <><div style={styles.spinner} />Generating with {currentProviderObj?.name || 'AI'}...</>
                ) : (
                  <>🎨 Generate with {currentProviderObj?.name || 'AI'}</>
                )}
              </button>
            </div>

            <div style={styles.rightPanel}>
              <div style={styles.previewArea}>
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.loadingState}>
                      <div style={styles.loadingSpinner} />
                      <div style={styles.loadingDots}>
                        <div style={styles.dot} />
                        <div style={{ ...styles.dot, animationDelay: '0.2s' }} />
                        <div style={{ ...styles.dot, animationDelay: '0.4s' }} />
                      </div>
                      <p style={styles.loadingText}>Creating your image with {currentProviderObj?.name || 'AI'}...</p>
                      <p style={styles.loadingSubtext}>This may take 10-60 seconds depending on the provider</p>
                    </motion.div>
                  ) : currentImage ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={styles.resultContainer}>
                      <div style={styles.imageWrapper}>
                        <img src={currentImage.url} alt={currentImage.prompt} style={styles.generatedImage} loading="eager" />
                        {currentImage.demo && <div style={styles.demoBadge}>Demo Mode</div>}
                        {currentImage.provider && !currentImage.demo && (
                          <div style={styles.providerBadge}>{PROVIDER_ICONS[currentImage.provider] || '🤖'} {currentImage.provider}</div>
                        )}
                      </div>
                      <div style={styles.imageActions}>
                        {currentImage.url && !currentImage.url.startsWith('data:') && (
                          <button onClick={() => window.open(currentImage.url, '_blank')} style={styles.actionBtn}>⬇ Download</button>
                        )}
                        <button onClick={() => {
                          if (currentImage.url.startsWith('data:')) {
                            const a = document.createElement('a'); a.href = currentImage.url; a.download = `ai-image-${Date.now()}.png`; a.click();
                          } else { copyToClipboard(currentImage.url); }
                        }} style={styles.actionBtn}>
                          {currentImage.url.startsWith('data:') ? '⬇ Download' : '📋 Copy URL'}
                        </button>
                        <button onClick={clearCurrent} style={styles.actionBtnSecondary}>Clear</button>
                      </div>
                      <p style={styles.promptText}>"{currentImage.prompt}"</p>
                      {currentImage.revisedPrompt && <p style={styles.revisedText}>AI revised: {currentImage.revisedPrompt}</p>}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.emptyState}>
                      <div style={styles.emptyIcon}>✨</div>
                      <h3 style={styles.emptyTitle}>Your vision starts here</h3>
                      <p style={styles.emptySub}>Type a prompt and click Generate to create stunning AI images</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* ─── GALLERY TAB ────────────────────────────────────────────────── */}
        {activeTab === 'gallery' && (
          <div style={styles.galleryContainer}>
            <div style={styles.galleryHeader}>
              <h2 style={styles.galleryTitle}>Your Gallery</h2>
              {history.length > 0 && <span style={styles.galleryCount}>{history.length} images</span>}
            </div>
            {history.length === 0 ? (
              <div style={styles.emptyGallery}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
                <p style={{ color: '#94a3b8' }}>No generations yet. Create your first image!</p>
                <button onClick={() => setActiveTab('create')} style={{ ...styles.generateBtn, marginTop: 20, width: 'auto', padding: '12px 24px' }}>Create an Image</button>
              </div>
            ) : (
              <div style={styles.galleryGrid}>
                {history.map((item) => (
                  <motion.div key={item._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    style={styles.galleryCard} className="gallery-card">
                    <div style={styles.galleryImageWrap}>
                      <img src={item.url} alt={item.prompt} style={styles.galleryImage} loading="lazy" />
                      <div style={styles.galleryOverlay} className="gallery-overlay">
                        <button onClick={() => {
                          if (item.url.startsWith('data:')) {
                            const a = document.createElement('a'); a.href = item.url; a.download = `ai-image-${item._id}.png`; a.click();
                          } else { window.open(item.url, '_blank'); }
                        }} style={styles.overlayBtn}>⬇</button>
                        <button onClick={() => deleteFromHistory(item._id)} style={styles.overlayBtn}>🗑</button>
                      </div>
                    </div>
                    <div style={styles.galleryInfo}>
                      <p style={styles.galleryPrompt}>{item.prompt}</p>
                      <div style={styles.galleryMeta}>
                        <span style={styles.galleryDate}>{new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.provider && <span style={styles.galleryProvider}>{item.provider}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── PROVIDERS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'providers' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>Your Providers</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {hasProviders
                    ? `${providers.length} provider${providers.length > 1 ? 's' : ''} connected`
                    : 'No providers connected yet. Set one up to get started.'}
                </p>
              </div>
              <button onClick={() => fetchProviders()} style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit',
              }}>🔄 Refresh</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {SETUP_PROVIDERS.map((p) => {
                const status = providerStatus[p.id];
                const isConnected = status?.configured;
                const testResult = testResults[p.id];
                const isTesting = testingProvider === p.id;
                return (
                  <div key={p.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, padding: '16px 18px',
                    display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: p.colorLight,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>{p.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                        <span style={{ fontSize: 14 }}>{isConnected ? '✅' : '❌'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {isConnected
                          ? <>Key: <code style={{ color: '#a78bfa', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: 3 }}>{status.maskedKey}</code></>
                          : <>Not connected yet</>
                        }
                      </div>
                      {testResult && (
                        <div style={{
                          marginTop: 6, fontSize: 12,
                          color: testResult.success ? '#6ee7b7' : '#fca5a5',
                          background: testResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          padding: '4px 8px', borderRadius: 6,
                        }}>
                          {testResult.success ? `✓ Connected successfully` : `✕ ${testResult.error || 'Connection failed'}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!isConnected && (
                        <button onClick={() => { setActiveTab('setup'); setSelectedSetupProvider(p); setSetupStep(2); }} style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          background: p.colorLight, border: `1px solid ${p.color}30`,
                          color: p.color, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>Setup</button>
                      )}
                      {isConnected && (
                        <button onClick={() => handleTestConnection(p.id)} disabled={isTesting} style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                          color: '#a78bfa', cursor: isTesting ? 'wait' : 'pointer',
                          fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>{isTesting ? '⟳ Testing...' : '🔧 Test'}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!hasProviders && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: 16, padding: 32, textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Get Started in 60 Seconds</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  Choose a provider, get your API key, paste it in. That's it!
                </p>
                <button onClick={() => setActiveTab('setup')} style={{
                  padding: '12px 28px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
                  color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>🚀 Start Setup</button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorBar}>
          <span>{error}</span>
          <button onClick={() => useAIStore.getState().clearError()} style={styles.errorClose}>✕</button>
        </div>
      )}

      {savedId && (
        <div style={styles.toast}>✅ Image saved to gallery</div>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#07050f',
    color: '#e2e8f0',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  nav: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(7, 5, 15, 0.9)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(99,102,241,0.08)',
  },
  navInner: {
    maxWidth: 1280, margin: '0 auto', padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#94a3b8', fontSize: 18, cursor: 'pointer',
    textDecoration: 'none', transition: 'all 0.2s',
  },
  brandIcon: { fontSize: 22 },
  brandText: { fontSize: 18, fontWeight: 700 },
  navTabs: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 },
  navTab: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: '#94a3b8', cursor: 'pointer', border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
  },
  navTabActive: { background: 'rgba(99,102,241,0.15)', color: '#a78bfa' },
  badge: { background: '#6366f1', color: 'white', fontSize: 10, padding: '1px 6px', borderRadius: 6 },
  main: {
    maxWidth: 1280, margin: '0 auto', padding: '24px',
    minHeight: 'calc(100vh - 64px)',
  },
  createLayout: {
    display: 'grid', gridTemplateColumns: '420px 1fr',
    gap: 24, height: 'calc(100vh - 112px)',
  },
  leftPanel: {
    display: 'flex', flexDirection: 'column', gap: 16,
    overflowY: 'auto', paddingRight: 8,
  },
  providerSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  providerSelector: { position: 'relative' },
  providerButton: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, color: '#e2e8f0', fontSize: 14,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
    fontFamily: 'inherit', transition: 'all 0.2s', textAlign: 'left',
  },
  providerIcon: { fontSize: 18 },
  providerName: { flex: 1, fontWeight: 500 },
  providerChevron: { fontSize: 10, color: '#64748b' },
  providerDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    marginTop: 4, background: '#13111c',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: 12, overflow: 'hidden', zIndex: 50,
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  },
  providerOption: {
    width: '100%', padding: '12px 14px',
    background: 'transparent', border: 'none',
    color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 10,
    fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left',
  },
  providerOptionActive: { background: 'rgba(99,102,241,0.08)' },
  providerOptionInfo: { flex: 1 },
  providerOptionName: { fontWeight: 600, fontSize: 13 },
  providerOptionDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  noProviders: { padding: '20px 16px', textAlign: 'center' },
  inputSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  inputWrapper: { position: 'relative' },
  textarea: {
    width: '100%', padding: '14px 44px 14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, color: '#e2e8f0', fontSize: 14,
    fontFamily: 'inherit', resize: 'none', outline: 'none',
    transition: 'border-color 0.2s', minHeight: 100, boxSizing: 'border-box',
  },
  enhanceBtn: {
    position: 'absolute', right: 8, top: 8, width: 32, height: 32,
    borderRadius: 8, background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.15)', color: '#a78bfa',
    fontSize: 14, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  tipBox: {
    padding: '8px 12px', background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.12)', borderRadius: 8,
    fontSize: 12, color: '#a78bfa',
  },
  styleSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  styleGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  styleChip: {
    padding: '6px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontFamily: 'inherit', transition: 'all 0.2s',
  },
  styleChipActive: {
    background: 'rgba(99,102,241,0.15)',
    borderColor: 'rgba(99,102,241,0.3)', color: '#a78bfa',
  },
  aspectSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  aspectGrid: { display: 'flex', gap: 6 },
  aspectChip: {
    padding: '8px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontFamily: 'inherit', transition: 'all 0.2s',
  },
  aspectChipActive: {
    background: 'rgba(99,102,241,0.15)',
    borderColor: 'rgba(99,102,241,0.3)', color: '#a78bfa',
  },
  aspectDim: { fontSize: 10, color: '#64748b' },
  generateBtn: {
    width: '100%', padding: '14px 20px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none', borderRadius: 14, color: 'white',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.2s',
  },
  generateBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: {
    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: 'white', borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  rightPanel: { display: 'flex', flexDirection: 'column' },
  previewArea: {
    flex: 1, background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    minHeight: 400, position: 'relative', overflow: 'hidden',
  },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 48, textAlign: 'center',
  },
  loadingSpinner: {
    width: 48, height: 48, border: '3px solid rgba(99,102,241,0.15)',
    borderTopColor: '#6366f1', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', marginBottom: 20,
  },
  loadingDots: { display: 'flex', gap: 8, marginBottom: 16 },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#6366f1', animation: 'pulse 1s ease infinite',
  },
  loadingText: { fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 },
  loadingSubtext: { fontSize: 13, color: '#64748b' },
  resultContainer: { width: '100%', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  imageWrapper: { position: 'relative', width: '100%', maxWidth: 512, marginBottom: 12 },
  generatedImage: {
    width: '100%', borderRadius: 12, display: 'block',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  demoBadge: {
    position: 'absolute', top: 8, left: 8,
    background: 'rgba(245,158,11,0.9)', color: 'white',
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
  },
  providerBadge: {
    position: 'absolute', top: 8, right: 8,
    background: 'rgba(0,0,0,0.7)', color: 'white',
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    backdropFilter: 'blur(4px)',
  },
  imageActions: { display: 'flex', gap: 6, marginBottom: 12 },
  actionBtn: {
    padding: '8px 14px', borderRadius: 8, fontSize: 13,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e2e8f0', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  actionBtnSecondary: {
    padding: '8px 14px', borderRadius: 8, fontSize: 13,
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit',
  },
  promptText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  revisedText: { fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 48, textAlign: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.8 },
  emptyTitle: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#64748b' },
  galleryContainer: { maxWidth: 1000, margin: '0 auto' },
  galleryHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  galleryTitle: { fontSize: 22, fontWeight: 700 },
  galleryCount: {
    background: 'rgba(99,102,241,0.1)', color: '#a78bfa',
    padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  },
  emptyGallery: {
    textAlign: 'center', padding: '60px 20px',
    background: 'rgba(255,255,255,0.02)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  galleryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16,
  },
  galleryCard: {
    borderRadius: 14, overflow: 'hidden',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  galleryImageWrap: { position: 'relative', aspectRatio: '1', overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' },
  galleryOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    opacity: 0, transition: 'opacity 0.2s',
  },
  overlayBtn: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: 'white', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  galleryInfo: { padding: '12px 14px' },
  galleryPrompt: {
    fontSize: 13, color: '#e2e8f0', marginBottom: 6,
    overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  galleryMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  galleryDate: { fontSize: 11, color: '#64748b' },
  galleryProvider: {
    fontSize: 10, color: '#a78bfa', background: 'rgba(99,102,241,0.1)',
    padding: '1px 6px', borderRadius: 4,
  },
  errorBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    padding: '12px 24px', background: 'rgba(239,68,68,0.95)',
    color: 'white', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', fontSize: 14, zIndex: 1000,
    backdropFilter: 'blur(8px)',
  },
  errorClose: {
    background: 'none', border: 'none', color: 'white',
    fontSize: 16, cursor: 'pointer', padding: '4px 8px',
  },
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    padding: '12px 20px', background: 'rgba(34,197,94,0.95)',
    color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600,
    zIndex: 1000, boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
    animation: 'fadeIn 0.3s ease',
  },
};
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIStore, PRESET_STYLES } from '../../stores/aiStore';

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

export default function AIPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    currentPrompt, selectedStyle, isGenerating, currentImage,
    history, error, setPrompt, setStyle,
    generate, saveGeneration, fetchHistory, deleteFromHistory, clearCurrent
  } = useAIStore();

  const [aspect, setAspect] = useState('1:1');
  const [showTips, setShowTips] = useState(false);
  const [enhanceText, setEnhanceText] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [activeTab, setActiveTab] = useState('create');
  const inputRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  const handleGenerate = useCallback(async () => {
    if (!currentPrompt.trim() || isGenerating) return;
    const ratio = ASPECT_RATIOS.find(r => r.id === aspect);
    const result = await generate(currentPrompt, selectedStyle);
    if (result?.url && !result.demo) {
      await saveGeneration(currentPrompt, result.url, selectedStyle);
      setSavedId(Date.now().toString());
      setTimeout(() => setSavedId(null), 2000);
    }
  }, [currentPrompt, isGenerating, aspect, selectedStyle, generate, saveGeneration]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  const handleEnhance = useCallback(() => {
    const tip = ENHANCE_TIPS[Math.floor(Math.random() * ENHANCE_TIPS.length)];
    setEnhanceText(tip);
    setTimeout(() => setEnhanceText(''), 3000);
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
  }, []);

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
      `}</style>

      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.navLeft}>
            <a href="/" style={styles.backBtn}>←</a>
            <div style={styles.brandIcon}>✨</div>
            <span style={styles.brandText}>AI Studio</span>
          </div>
          <div style={styles.navTabs}>
            <button onClick={() => setActiveTab('create')} style={{ ...styles.navTab, ...(activeTab === 'create' ? styles.navTabActive : {}) }}>Create</button>
            <button onClick={() => { setActiveTab('gallery'); fetchHistory(); }} style={{ ...styles.navTab, ...(activeTab === 'gallery' ? styles.navTabActive : {}) }}>
              Gallery {history.length > 0 && <span style={styles.badge}>{history.length}</span>}
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.main}>
        {activeTab === 'create' ? (
          <div style={styles.createLayout}>
            <div style={styles.leftPanel}>
              <div style={styles.inputSection}>
                <label style={styles.label}>Prompt</label>
                <div style={styles.inputWrapper}>
                  <textarea
                    ref={inputRef}
                    value={currentPrompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the image you want to create..."
                    style={styles.textarea}
                    rows={4}
                  />
                  <button onClick={handleEnhance} style={styles.enhanceBtn} title="Enhance prompt">
                    ✨
                  </button>
                </div>
                {enhanceText && (
                  <div style={styles.tipBox}>
                    💡 {enhanceText}
                  </div>
                )}
              </div>

              <div style={styles.styleSection}>
                <label style={styles.label}>Style</label>
                <div style={styles.styleGrid}>
                  {PRESET_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      style={{
                        ...styles.styleChip,
                        ...(selectedStyle === s.id ? styles.styleChipActive : {})
                      }}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.aspectSection}>
                <label style={styles.label}>Aspect Ratio</label>
                <div style={styles.aspectGrid}>
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setAspect(r.id)}
                      style={{
                        ...styles.aspectChip,
                        ...(aspect === r.id ? styles.aspectChipActive : {})
                      }}
                    >
                      {r.label}
                      <span style={styles.aspectDim}>{r.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !currentPrompt.trim()}
                style={{
                  ...styles.generateBtn,
                  ...(isGenerating ? styles.generateBtnDisabled : {}),
                  ...(!currentPrompt.trim() ? styles.generateBtnDisabled : {})
                }}
              >
                {isGenerating ? (
                  <>
                    <div style={styles.spinner} />
                    Generating...
                  </>
                ) : (
                  <>🎨 Generate</>
                )}
              </button>
            </div>

            <div style={styles.rightPanel}>
              <div style={styles.previewArea}>
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={styles.loadingState}
                    >
                      <div style={styles.loadingSpinner} />
                      <div style={styles.loadingDots}>
                        <div style={styles.dot} />
                        <div style={{ ...styles.dot, animationDelay: '0.2s' }} />
                        <div style={{ ...styles.dot, animationDelay: '0.4s' }} />
                      </div>
                      <p style={styles.loadingText}>AI is creating your masterpiece...</p>
                    </motion.div>
                  ) : currentImage ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      style={styles.resultContainer}
                    >
                      <div style={styles.imageWrapper}>
                        <img src={currentImage.url} alt={currentImage.prompt} style={styles.generatedImage} />
                        {currentImage.demo && (
                          <div style={styles.demoBadge}>Demo Mode</div>
                        )}
                      </div>
                      <div style={styles.imageActions}>
                        <button onClick={() => window.open(currentImage.url, '_blank')} style={styles.actionBtn}>⬇ Download</button>
                        <button onClick={() => copyToClipboard(currentImage.url)} style={styles.actionBtn}>📋 Copy URL</button>
                        <button onClick={clearCurrent} style={styles.actionBtnSecondary}>Clear</button>
                      </div>
                      <p style={styles.promptText}>"{currentImage.prompt}"</p>
                      {currentImage.revisedPrompt && (
                        <p style={styles.revisedText}>AI revised: {currentImage.revisedPrompt}</p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={styles.emptyState}
                    >
                      <div style={styles.emptyIcon}>✨</div>
                      <h3 style={styles.emptyTitle}>Your vision starts here</h3>
                      <p style={styles.emptySub}>Type a prompt and click Generate to create stunning AI images</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.galleryContainer}>
            <div style={styles.galleryHeader}>
              <h2 style={styles.galleryTitle}>Your Gallery</h2>
              {history.length > 0 && (
                <span style={styles.galleryCount}>{history.length} images</span>
              )}
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
                  <motion.div
                    key={item._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={styles.galleryCard}
                    className="gallery-card"
                  >
                    <div style={styles.galleryImageWrap}>
                      <img src={item.url} alt={item.prompt} style={styles.galleryImage} />
                      <div style={styles.galleryOverlay} className="gallery-overlay">
                        <button onClick={() => window.open(item.url, '_blank')} style={styles.overlayBtn}>⬇</button>
                        <button onClick={() => deleteFromHistory(item._id)} style={styles.overlayBtn}>🗑</button>
                      </div>
                    </div>
                    <div style={styles.galleryInfo}>
                      <p style={styles.galleryPrompt}>{item.prompt}</p>
                      <span style={styles.galleryDate}>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
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
        <div style={styles.toast}>
          ✅ Image saved to gallery
        </div>
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
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(7, 5, 15, 0.9)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(99,102,241,0.08)',
  },
  navInner: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: 18,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  brandIcon: { fontSize: 22 },
  brandText: { fontSize: 18, fontWeight: 700 },
  navTabs: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 },
  navTab: {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  navTabActive: {
    background: 'rgba(99,102,241,0.15)',
    color: '#a78bfa',
  },
  badge: {
    background: '#6366f1',
    color: 'white',
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 6,
  },
  main: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '24px',
    minHeight: 'calc(100vh - 64px)',
  },
  createLayout: {
    display: 'grid',
    gridTemplateColumns: '420px 1fr',
    gap: 24,
    height: 'calc(100vh - 112px)',
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    overflowY: 'auto',
    paddingRight: 8,
  },
  inputSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  inputWrapper: { position: 'relative' },
  textarea: {
    width: '100%',
    padding: '14px 44px 14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
    transition: 'all 0.2s',
  },
  enhanceBtn: {
    position: 'absolute',
    right: 10,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(99,102,241,0.1)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    transition: 'all 0.2s',
  },
  tipBox: {
    padding: '10px 14px',
    background: 'rgba(99,102,241,0.08)',
    borderRadius: 10,
    fontSize: 13,
    color: '#a78bfa',
    animation: 'fadeIn 0.3s ease',
  },
  styleSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  styleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  styleChip: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  styleChipActive: {
    background: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.3)',
    color: '#a78bfa',
  },
  aspectSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  aspectGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 },
  aspectChip: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  aspectChipActive: {
    background: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.3)',
    color: '#a78bfa',
  },
  aspectDim: { fontSize: 10, color: '#64748b' },
  generateBtn: {
    padding: '14px 24px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    width: '100%',
  },
  generateBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    border: '3px solid rgba(99,102,241,0.1)',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingDots: { display: 'flex', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#6366f1',
    animation: 'fadeIn 0.6s infinite alternate',
  },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 600,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
  },
  generatedImage: { width: '100%', height: 'auto', display: 'block', borderRadius: 16 },
  demoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    color: '#f59e0b',
    backdropFilter: 'blur(4px)',
  },
  imageActions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  actionBtnSecondary: {
    padding: '8px 16px',
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#64748b',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  promptText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' },
  revisedText: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' },
  emptyIcon: { fontSize: 64, opacity: 0.5 },
  emptyTitle: { fontSize: 20, fontWeight: 600 },
  emptySub: { fontSize: 14, color: '#64748b', maxWidth: 320 },

  galleryContainer: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  galleryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  galleryTitle: { fontSize: 22, fontWeight: 700 },
  galleryCount: { fontSize: 14, color: '#64748b' },
  emptyGallery: { textAlign: 'center', padding: '80px 24px' },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  galleryCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    transition: 'all 0.2s',
  },
  galleryImageWrap: {
    position: 'relative',
    aspectRatio: '1',
    overflow: 'hidden',
  },
  galleryImage: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' },
  galleryOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  overlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: 'white',
    fontSize: 16,
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryInfo: { padding: '12px 14px' },
  galleryPrompt: {
    fontSize: 13,
    color: '#cbd5e1',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: 4,
  },
  galleryDate: { fontSize: 11, color: '#64748b' },

  errorBar: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 20px',
    background: 'rgba(239,68,68,0.15)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 12,
    color: '#fca5a5',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 200,
    animation: 'fadeIn 0.3s ease',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: 14,
    padding: 2,
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    padding: '12px 20px',
    background: 'rgba(16,185,129,0.15)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 12,
    color: '#6ee7b7',
    fontSize: 14,
    fontWeight: 500,
    zIndex: 200,
    animation: 'fadeIn 0.3s ease',
  },
};

'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiUpload, FiImage, FiTrash2, FiDroplet
} from 'react-icons/fi';
import { useWallpaperStore, BUILTIN_WALLPAPERS } from '../stores/wallpaperStore';
import { uploadAPI } from '../lib/api';

export default function WallpaperPicker({ isOpen, onClose }) {
  const { wallpaper, setWallpaper, resetWallpaper } = useWallpaperStore();
  const [blur, setBlur] = useState(wallpaper.blur);
  const [brightness, setBrightness] = useState(wallpaper.brightness);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const hasWallpaper = wallpaper.type !== 'default';

  const selectBuiltin = useCallback((wp) => {
    if (wp.id === 'default') {
      resetWallpaper();
    } else {
      setWallpaper({
        type: 'gradient',
        gradient: wp.gradient,
        url: null,
        blur: 0,
        brightness: 0.6
      });
    }
    setBlur(0);
    setBrightness(0.6);
  }, [setWallpaper, resetWallpaper]);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadAPI.wallpaper(file);
      const { url } = res.data;
      setWallpaper({ type: 'image', url, gradient: null, blur: 0, brightness: 0.6 });
      setBlur(0);
      setBrightness(0.6);
    } catch (err) {
      console.error('[WallpaperPicker] Upload failed:', err);
      // Fallback: use local blob URL so upload failure doesn't break UX
      const fallbackUrl = URL.createObjectURL(file);
      setWallpaper({ type: 'image', url: fallbackUrl, gradient: null, blur: 0, brightness: 0.6 });
    } finally {
      setUploading(false);
    }
  }, [setWallpaper]);

  const applyBlur = useCallback((value) => {
    setBlur(value);
    setWallpaper({ blur: Number(value) });
  }, [setWallpaper]);

  const applyBrightness = useCallback((value) => {
    setBrightness(value);
    setWallpaper({ brightness: Number(value) });
  }, [setWallpaper]);

  const handleReset = useCallback(() => {
    resetWallpaper();
    setBlur(0);
    setBrightness(0.6);
    onClose();
  }, [resetWallpaper, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="wp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="wp-modal"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="wp-header">
              <div className="wp-header-left">
                <FiDroplet size={18} />
                <h3>App Wallpaper</h3>
              </div>
              <button className="wp-close-btn" onClick={onClose} aria-label="Close">
                <FiX size={18} />
              </button>
            </div>

            <div className="wp-body">
              <div className="wp-section-label">Built-in</div>
              <div className="wp-grid">
                {BUILTIN_WALLPAPERS.map((wp) => {
                  const isActive =
                    wp.id === 'default'
                      ? wallpaper.type === 'default'
                      : wallpaper.type === 'gradient' && wallpaper.gradient === wp.gradient;
                  return (
                    <button
                      key={wp.id}
                      className={`wp-thumb ${isActive ? 'active' : ''}`}
                      style={wp.gradient ? { background: wp.gradient } : { background: 'var(--surface)' }}
                      onClick={() => selectBuiltin(wp)}
                      title={wp.name}
                    >
                      <span className="wp-thumb-label">{wp.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="wp-section-label">Custom Image</div>
              <button
                className="wp-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FiUpload size={16} />
                <span>{uploading ? 'Uploading…' : 'Upload Image'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />

              {wallpaper.url && wallpaper.type === 'image' && (
                <div
                  className="wp-preview"
                  style={{ backgroundImage: `url(${wallpaper.url})` }}
                />
              )}

              {hasWallpaper && (
                <>
                  <div className="wp-divider" />

                  <div className="wp-slider-row">
                    <span className="wp-slider-label">
                      <FiImage size={14} /> Blur
                    </span>
                    <input
                      type="range"
                      className="wp-slider"
                      min={0}
                      max={20}
                      step={1}
                      value={blur}
                      onChange={(e) => setBlur(Number(e.target.value))}
                      onMouseUp={() => applyBlur(blur)}
                      onTouchEnd={() => applyBlur(blur)}
                    />
                    <span className="wp-slider-val">{blur}px</span>
                  </div>

                  <div className="wp-slider-row">
                    <span className="wp-slider-label">
                      <FiImage size={14} /> Brightness
                    </span>
                    <input
                      type="range"
                      className="wp-slider"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      onMouseUp={() => applyBrightness(brightness)}
                      onTouchEnd={() => applyBrightness(brightness)}
                    />
                    <span className="wp-slider-val">{Math.round(brightness * 100)}%</span>
                  </div>

                  <button className="wp-reset-btn" onClick={handleReset}>
                    <FiTrash2 size={14} />
                    <span>Reset to Default Wallpaper</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

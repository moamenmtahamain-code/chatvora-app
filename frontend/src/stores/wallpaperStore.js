'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'chatvora_global_wallpaper';

const DEFAULT_WALLPAPER = {
  type: 'default',
  gradient: null,
  url: null,
  blur: 0,
  brightness: 0.6
};

export const BUILTIN_WALLPAPERS = [
  { id: 'default', name: 'Default', gradient: null, thumbnail: null },
  { id: 'midnight', name: 'Midnight', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', thumbnail: null },
  { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, #0b3d0b 0%, #1a5c1a 50%, #2d7d2d 100%)', thumbnail: null },
  { id: 'royal', name: 'Royal', gradient: 'linear-gradient(135deg, #1a0033 0%, #4a0080 50%, #6600cc 100%)', thumbnail: null },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 50%, #efefd0 100%)', thumbnail: null },
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #0077b6 0%, #00b4d8 50%, #90e0ef 100%)', thumbnail: null },
  { id: 'rose', name: 'Rose', gradient: 'linear-gradient(135deg, #590d22 0%, #800f2f 50%, #a4133c 100%)', thumbnail: null },
  { id: 'charcoal', name: 'Charcoal', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', thumbnail: null },
  { id: 'lavender', name: 'Lavender', gradient: 'linear-gradient(135deg, #2d1b69 0%, #4a2c8a 50%, #7b5ea7 100%)', thumbnail: null },
  { id: 'teal', name: 'Teal', gradient: 'linear-gradient(135deg, #004d40 0%, #00695c 50%, #00897b 100%)', thumbnail: null }
];

function loadFromStorage() {
  if (typeof window === 'undefined') return { ...DEFAULT_WALLPAPER };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WALLPAPER };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WALLPAPER, ...parsed };
  } catch {
    return { ...DEFAULT_WALLPAPER };
  }
}

function saveToStorage(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[wallpaperStore] Failed to save to localStorage:', e);
  }
}

export const useWallpaperStore = create((set, get) => ({
  wallpaper: loadFromStorage(),

  setWallpaper: (updates) => {
    const next = { ...get().wallpaper, ...updates };
    saveToStorage(next);
    set({ wallpaper: next });
  },

  resetWallpaper: () => {
    saveToStorage(DEFAULT_WALLPAPER);
    set({ wallpaper: { ...DEFAULT_WALLPAPER } });
  },

  getWallpaperStyle: () => {
    const w = get().wallpaper;
    if (w.type === 'default' || (!w.gradient && !w.url)) return {};
    const base = {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      '--wp-blur': `${w.blur}px`,
      '--wp-brightness': w.brightness
    };
    if (w.url) return { ...base, backgroundImage: `url(${w.url})` };
    if (w.gradient) return { ...base, backgroundImage: w.gradient };
    return {};
  }
}));

export default useWallpaperStore;

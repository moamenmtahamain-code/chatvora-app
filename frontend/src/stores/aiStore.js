import { create } from 'zustand';
import { aiAPI } from '../lib/api';

const PRESET_STYLES = [
  { id: 'realistic', label: 'Realistic', icon: '📷' },
  { id: 'fantasy', label: 'Fantasy', icon: '🧙' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆' },
  { id: 'anime', label: 'Anime', icon: '🌸' },
  { id: '3d', label: '3D Render', icon: '🎨' },
  { id: 'oil_painting', label: 'Oil Painting', icon: '🖼️' },
  { id: 'watercolor', label: 'Watercolor', icon: '🎨' },
  { id: 'pixel_art', label: 'Pixel Art', icon: '🕹️' },
];

export { PRESET_STYLES };

export const useAIStore = create((set, get) => ({
  currentPrompt: '',
  selectedStyle: 'realistic',
  isGenerating: false,
  currentImage: null,
  history: [],
  error: null,

  setPrompt: (prompt) => set({ currentPrompt: prompt }),
  setStyle: (style) => set({ selectedStyle: style }),
  clearError: () => set({ error: null }),

  generate: async (prompt, style) => {
    set({ isGenerating: true, error: null, currentImage: null });
    try {
      const response = await aiAPI.generateImage({
        prompt: prompt || get().currentPrompt,
        style: style || get().selectedStyle
      });
      const { url, revisedPrompt, demo } = response.data;
      set({ currentImage: { url, prompt, revisedPrompt, demo: !!demo }, isGenerating: false });
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to generate image';
      set({ error: msg, isGenerating: false });
      return null;
    }
  },

  saveGeneration: async (prompt, url, style) => {
    try {
      await aiAPI.saveGeneration({ prompt, url, style: style || get().selectedStyle });
      get().fetchHistory();
    } catch (e) {
      console.error('Failed to save generation:', e);
    }
  },

  fetchHistory: async () => {
    try {
      const response = await aiAPI.getHistory();
      set({ history: response.data });
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  },

  deleteFromHistory: async (id) => {
    try {
      await aiAPI.deleteGeneration(id);
      set((state) => ({ history: state.history.filter((h) => h._id !== id) }));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  },

  clearCurrent: () => set({ currentImage: null, currentPrompt: '', error: null })
}));

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
  selectedProvider: 'openai',
  aspectRatio: '1:1',
  isGenerating: false,
  currentImage: null,
  history: [],
  error: null,
  providers: [],
  providerStatus: {},
  providersLoaded: false,
  isDemoMode: false,
  testingProvider: null,
  testResults: {},

  setPrompt: (prompt) => set({ currentPrompt: prompt }),
  setStyle: (style) => set({ selectedStyle: style }),
  setProvider: (provider) => set({ selectedProvider: provider }),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  clearError: () => set({ error: null }),

  fetchProviders: async () => {
    try {
      const response = await aiAPI.getProviders();
      const { providers, defaultProvider, demo, providerStatus } = response.data;
      set({
        providers,
        providerStatus: providerStatus || {},
        providersLoaded: true,
        selectedProvider: defaultProvider || providers[0]?.id || 'openai',
        isDemoMode: !!demo,
      });
    } catch (e) {
      console.error('Failed to fetch providers:', e);
      set({ providersLoaded: true, isDemoMode: true });
    }
  },

  fetchProviderStatus: async () => {
    try {
      const response = await aiAPI.getProviderStatus();
      set({ providerStatus: response.data.providers || {} });
      return response.data;
    } catch (e) {
      console.error('Failed to fetch provider status:', e);
      return null;
    }
  },

  testConnection: async (providerId) => {
    set({ testingProvider: providerId });
    try {
      const response = await aiAPI.testConnection(providerId);
      const result = response.data;
      set((state) => ({
        testingProvider: null,
        testResults: { ...state.testResults, [providerId]: result },
      }));
      return result;
    } catch (e) {
      const result = { success: false, error: e.response?.data?.error || e.message || 'Connection test failed' };
      set((state) => ({
        testingProvider: null,
        testResults: { ...state.testResults, [providerId]: result },
      }));
      return result;
    }
  },

  generate: async (prompt, style, aspectRatio, provider) => {
    set({ isGenerating: true, error: null, currentImage: null });
    try {
      const response = await aiAPI.generateImage({
        prompt: prompt || get().currentPrompt,
        style: style || get().selectedStyle,
        aspectRatio: aspectRatio || get().aspectRatio,
        provider: provider || get().selectedProvider,
      });
      const { url, revisedPrompt, demo, provider: usedProvider } = response.data;
      set({
        currentImage: { url, prompt, revisedPrompt, demo: !!demo, provider: usedProvider },
        isGenerating: false,
      });
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to generate image';
      set({ error: msg, isGenerating: false });
      return null;
    }
  },

  saveGeneration: async (prompt, url, style, aspectRatio, provider) => {
    try {
      await aiAPI.saveGeneration({
        prompt,
        url,
        style: style || get().selectedStyle,
        aspectRatio: aspectRatio || get().aspectRatio,
        provider: provider || get().selectedProvider,
      });
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

  clearCurrent: () => set({ currentImage: null, currentPrompt: '', error: null }),
}));
import { create } from 'zustand';
import { authAPI, userAPI } from '../lib/api';
import { initSocket, disconnectSocket } from '../lib/socket';

const getAuthErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((item) => item.msg).join(', ');
  }
  if (error.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Make sure the backend is running on port 5000.';
  }
  return fallback;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const response = await authAPI.me();
      set({ user: response.data, isAuthenticated: true, isLoading: false });
      initSocket(token);
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      initSocket(accessToken);
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({ error: getAuthErrorMessage(error, 'Login failed'), isLoading: false });
      return false;
    }
  },

  register: async (email, password, username, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({ email, password, username, displayName });
      const { user, accessToken, refreshToken } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      initSocket(accessToken);
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({ error: getAuthErrorMessage(error, 'Registration failed'), isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }

    disconnectSocket();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      set({ user: response.data });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message });
      return false;
    }
  },

  updateOnlineStatus: (isOnline) => {
    set((state) => ({
      user: state.user ? { ...state.user, isOnline } : null
    }));
  }
}));

export default useAuthStore;

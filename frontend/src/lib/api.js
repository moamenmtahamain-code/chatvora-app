import axios from 'axios';
import { initSocket } from './socket';

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }

  return 'http://127.0.0.1:5000/api';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Update socket auth with new token
        initSocket(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken })
};

export const userAPI = {
  search: (query) => api.get(`/users/search?q=${query}`),
  getUser: (id) => api.get(`/users/${id}`),
  blockUser: (id) => api.put(`/users/${id}/block`),
  addContact: (id) => api.post(`/users/contact/${id}`),
  getQR: () => api.get('/users/qr/generate'),
  scanQR: (id) => api.get(`/users/qr/scan/${id}`),
  getOnlineStatus: (id) => api.get(`/users/online-status/${id}`)
};

export const groupAPI = {
  getOne: (id) => api.get(`/groups/${id}`),
  getMembers: (id) => api.get(`/groups/${id}/members?limit=200`),
  update: (id, data) => api.put(`/groups/${id}`, data)
};

export const conversationAPI = {
  getAll: () => api.get('/conversations'),
  create: (data) => api.post('/conversations', data),
  createGroup: (data) => api.post('/groups', data),
  getOne: (id) => api.get(`/conversations/${id}`),
  archive: (id) => api.put(`/conversations/${id}/archive`),
  pin: (id) => api.put(`/conversations/${id}/pin`),
  mute: (id) => api.put(`/conversations/${id}/mute`),
  leave: (id) => api.put(`/conversations/${id}/leave`),
  addParticipants: (id, userIds) => api.put(`/conversations/${id}/add`, { userIds }),
  wallpaper: (id, data) => api.put(`/conversations/${id}/wallpaper`, data)
};

export const messageAPI = {
  getConversationMessages: (conversationId, before) =>
    api.get(`/messages/conversation/${conversationId}?before=${before || ''}`),
  send: (data) => api.post('/messages', data),
  edit: (id, content) => api.put(`/messages/${id}`, { content }),
  delete: (id, forEveryone) => api.delete(`/messages/${id}?forEveryone=${forEveryone}`),
  react: (id, emoji) => api.put(`/messages/${id}/react`, { emoji }),
  pin: (id) => api.put(`/messages/${id}/pin`),
  star: (id) => api.put(`/messages/${id}/star`),
  search: (conversationId, query) => api.get(`/messages/search/${conversationId}?q=${query}`),
  forward: (id, conversationIds) => api.post(`/messages/${id}/forward`, { conversationIds })
};

export const uploadAPI = {
  single: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  multiple: (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  avatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  wallpaper: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const callAPI = {
  initiate: (data) => api.post('/calls/initiate', data),
  get: (id) => api.get(`/calls/${id}`),
  updateStatus: (id, status) => api.put(`/calls/${id}/status`, { status }),
  join: (id) => api.post(`/calls/${id}/join`),
  getHistory: () => api.get('/calls/history')
};

export const storyAPI = {
  create: (data) => api.post('/stories', data),
  getFeed: () => api.get('/stories/feed'),
  getOne: (id) => api.get(`/stories/${id}`),
  view: (id) => api.put(`/stories/${id}/view`),
  react: (id) => api.put(`/stories/${id}/react`),
  delete: (id) => api.delete(`/stories/${id}`),
  getMyStories: () => api.get('/stories/my/all')
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  delete: (id) => api.delete(`/notifications/${id}`)
};

export const aiAPI = {
  generateImage: (data) => api.post('/ai/generate-image', data),
  getHistory: () => api.get('/ai/history'),
  saveGeneration: (data) => api.post('/ai/save', data),
  deleteGeneration: (id) => api.delete(`/ai/history/${id}`)
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (page, search) => api.get(`/admin/users?page=${page}&search=${search || ''}`),
  updateUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`)
};

export default api;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Appearance
      theme: 'dark',
      compactMode: false,
      messageFontSize: 'medium', // 'small' | 'medium' | 'large'

      // Notifications
      notificationsEnabled: true,
      notifyMessages: true,
      notifyCalls: true,
      notifyGroups: true,
      notifySound: true,
      notifyPreview: true,

      // Calling
      preferredCallType: 'audio', // 'audio' | 'video'

      // Privacy
      readReceipts: true,
      showOnlineStatus: true,
      lastSeen: true,

      // Chat
      enterToSend: true,
      showTypingIndicators: true,

      // Actions
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setCompactMode: (compactMode) => set({ compactMode }),
      setMessageFontSize: (messageFontSize) => set({ messageFontSize }),

      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setNotifyMessages: (v) => set({ notifyMessages: v }),
      setNotifyCalls: (v) => set({ notifyCalls: v }),
      setNotifyGroups: (v) => set({ notifyGroups: v }),
      setNotifySound: (v) => set({ notifySound: v }),
      setNotifyPreview: (v) => set({ notifyPreview: v }),

      setPreferredCallType: (v) => set({ preferredCallType: v }),
      setReadReceipts: (v) => set({ readReceipts: v }),
      setShowOnlineStatus: (v) => set({ showOnlineStatus: v }),
      setLastSeen: (v) => set({ lastSeen: v }),
      setEnterToSend: (v) => set({ enterToSend: v }),
      setShowTypingIndicators: (v) => set({ showTypingIndicators: v }),

      // Reset all settings to defaults
      resetSettings: () => set({
        theme: 'dark',
        compactMode: false,
        messageFontSize: 'medium',
        notificationsEnabled: true,
        notifyMessages: true,
        notifyCalls: true,
        notifyGroups: true,
        notifySound: true,
        notifyPreview: true,
        preferredCallType: 'audio',
        readReceipts: true,
        showOnlineStatus: true,
        lastSeen: true,
        enterToSend: true,
        showTypingIndicators: true,
      }),
    }),
    {
      name: 'chatvora-settings',
      partialize: (state) => {
        const { setTheme, toggleTheme, setCompactMode, setMessageFontSize, setNotificationsEnabled, setNotifyMessages, setNotifyCalls, setNotifyGroups, setNotifySound, setNotifyPreview, setPreferredCallType, setReadReceipts, setShowOnlineStatus, setLastSeen, setEnterToSend, setShowTypingIndicators, resetSettings, ...persisted } = state;
        return persisted;
      },
    }
  )
);

export default useSettingsStore;

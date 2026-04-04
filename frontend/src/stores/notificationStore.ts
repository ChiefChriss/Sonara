import { create } from 'zustand';
import { apiFetch } from '../utils/api';

interface NotificationStore {
  unreadCount: number;
  _intervalId: ReturnType<typeof setInterval> | null;
  fetchUnreadCount: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  clearCount: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCount: 0,
  _intervalId: null,

  fetchUnreadCount: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    apiFetch('/api/auth/notifications/unread-count/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) set({ unreadCount: d.unread_count }); })
      .catch(() => {});
  },

  startPolling: () => {
    const state = get();
    // Don't start multiple intervals
    if (state._intervalId) return;
    state.fetchUnreadCount();
    const id = setInterval(() => {
      get().fetchUnreadCount();
    }, 30000); // every 30 seconds
    set({ _intervalId: id });
  },

  stopPolling: () => {
    const id = get()._intervalId;
    if (id) {
      clearInterval(id);
      set({ _intervalId: null });
    }
  },

  clearCount: () => set({ unreadCount: 0 }),
}));

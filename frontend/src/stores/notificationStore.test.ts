import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useNotificationStore.setState({
      unreadCount: 0,
      _intervalId: null,
    });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    useNotificationStore.getState().stopPolling();
  });

  it('starts with unreadCount 0', () => {
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount).toBe(0);
  });

  it('clearCount sets unreadCount to 0', () => {
    useNotificationStore.setState({ unreadCount: 5 });
    useNotificationStore.getState().clearCount();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('fetchUnreadCount does nothing without accessToken', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useNotificationStore.getState().fetchUnreadCount();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetchUnreadCount calls API and updates count', async () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ unread_count: 3 }),
    } as Response);

    useNotificationStore.getState().fetchUnreadCount();
    // Wait for promise chain
    await new Promise((r) => setTimeout(r, 10));

    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  it('fetchUnreadCount handles failed response', async () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
    } as Response);

    useNotificationStore.getState().fetchUnreadCount();
    await new Promise((r) => setTimeout(r, 10));

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('fetchUnreadCount handles network error', async () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    useNotificationStore.getState().fetchUnreadCount();
    await new Promise((r) => setTimeout(r, 10));

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('startPolling sets up interval', () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unread_count: 0 }),
    } as Response);

    useNotificationStore.getState().startPolling();
    expect(useNotificationStore.getState()._intervalId).not.toBeNull();
  });

  it('startPolling does not create duplicate intervals', () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unread_count: 0 }),
    } as Response);

    useNotificationStore.getState().startPolling();
    const firstId = useNotificationStore.getState()._intervalId;

    useNotificationStore.getState().startPolling();
    const secondId = useNotificationStore.getState()._intervalId;

    expect(firstId).toBe(secondId);
  });

  it('stopPolling clears interval', () => {
    localStorage.setItem('accessToken', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unread_count: 0 }),
    } as Response);

    useNotificationStore.getState().startPolling();
    expect(useNotificationStore.getState()._intervalId).not.toBeNull();

    useNotificationStore.getState().stopPolling();
    expect(useNotificationStore.getState()._intervalId).toBeNull();
  });
});

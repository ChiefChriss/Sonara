import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('adds Authorization header when accessToken exists', async () => {
    localStorage.setItem('accessToken', 'my-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch('/api/test/');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('does not add Authorization header without token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch('/api/test/');

    const callHeaders = (globalThis.fetch as any).mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('sets Content-Type to JSON by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch('/api/test/');

    const callHeaders = (globalThis.fetch as any).mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBe('application/json');
  });

  it('refreshes token on 401 and retries', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    localStorage.setItem('refreshToken', 'my-refresh');

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      // First call: 401
      .mockResolvedValueOnce({ status: 401, ok: false } as Response)
      // Refresh call: success
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ access: 'new-token' }),
      } as Response)
      // Retry call: success
      .mockResolvedValueOnce({ status: 200, ok: true } as Response);

    const res = await apiFetch('/api/test/');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('accessToken')).toBe('new-token');

    // Verify retry used new token
    const retryHeaders = fetchMock.mock.calls[2][1]!.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-token');
  });

  it('redirects to login when no refresh token on 401', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    // No refreshToken set

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 401,
      ok: false,
    } as Response);

    // Mock window.location
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    await apiFetch('/api/test/');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('redirects to login when refresh token is also expired', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    localStorage.setItem('refreshToken', 'also-expired');

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ status: 401, ok: false } as Response)
      .mockResolvedValueOnce({ status: 401, ok: false } as Response);

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    await apiFetch('/api/test/');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

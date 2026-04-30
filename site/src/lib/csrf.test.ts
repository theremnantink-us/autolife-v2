// site/src/lib/csrf.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchCsrfToken } from './csrf';

describe('fetchCsrfToken', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns token from /csrf.php response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrf_token: 'abc123' }),
    }));
    const token = await fetchCsrfToken();
    expect(token).toBe('abc123');
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchCsrfToken()).rejects.toThrow('CSRF endpoint returned 500');
  });

  it('throws when csrf_token missing from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));
    await expect(fetchCsrfToken()).rejects.toThrow('no csrf_token');
  });
});

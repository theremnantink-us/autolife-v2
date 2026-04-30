// site/src/lib/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitBooking, fetchBusyDates, checkHealth } from './api';

describe('api.ts', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  describe('submitBooking', () => {
    it('posts to /api.php and returns success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, appointment_id: 42, message: 'ok' }),
      }));
      const result = await submitBooking({
        name: 'Иван', phone: '+79001112233',
        carBrand: 'Mercedes', carModel: 'S680',
        service: 'Керамика', date: '2026-05-01 14:30',
        additionalInfo: '', csrf_token: 'tok',
      });
      expect(result.success).toBe(true);
      expect(result.appointment_id).toBe(42);
    });

    it('returns error object on validation failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 400,
        json: async () => ({ success: false, message: 'Некорректный номер' }),
      }));
      const result = await submitBooking({
        name: 'x', phone: '123', carBrand: 'a', carModel: 'b',
        service: 's', date: '2026-05-01 14:30', additionalInfo: '', csrf_token: 'tok',
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Некорректный номер');
    });

    it('returns user-facing network message when fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')));
      const result = await submitBooking({
        name: 'x', phone: '+79001112233', carBrand: 'a', carModel: 'b',
        service: 's', date: '2026-05-01 14:30', additionalInfo: '', csrf_token: 'tok',
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Сеть недоступна. Попробуйте ещё раз.');
    });
  });

  describe('fetchBusyDates', () => {
    it('returns array from /busy_dates.php', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, busy_dates: ['2026-04-25', '2026-04-30'] }),
      }));
      expect(await fetchBusyDates()).toEqual(['2026-04-25', '2026-04-30']);
    });

    it('returns empty array when backend fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      expect(await fetchBusyDates()).toEqual([]);
    });
  });

  describe('checkHealth', () => {
    it('returns ok=true when backend is healthy', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '2026-04-24 12:00:00' }),
      }));
      expect(await checkHealth()).toBe(true);
    });

    it('returns false on any error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      expect(await checkHealth()).toBe(false);
    });
  });
});

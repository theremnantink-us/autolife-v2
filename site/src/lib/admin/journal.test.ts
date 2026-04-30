import { describe, it, expect } from 'vitest';
import {
  formatDateInput, addDays, accrualsForDate, summarizeDay, isLockedByPayout,
} from './journal';
import type { SalaryAccrual } from './types';

const mk = (over: Partial<SalaryAccrual>): SalaryAccrual => ({
  id: 'a' + Math.random().toString(36).slice(2, 8),
  employeeId: 'ivan',
  accrualDate: '2026-04-27',
  roleKind: 'master',
  amount: 1000,
  createdAt: '2026-04-27T10:00:00.000Z',
  ...over,
});

describe('formatDateInput', () => {
  it('returns YYYY-MM-DD in local timezone', () => {
    expect(formatDateInput(new Date(2026, 3, 27))).toBe('2026-04-27');
    expect(formatDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDateInput(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('addDays', () => {
  it('handles month rollover forward', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('handles month rollover backward', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('accrualsForDate', () => {
  it('filters strictly by accrualDate', () => {
    const rows = [
      mk({ id: 'a', accrualDate: '2026-04-26' }),
      mk({ id: 'b', accrualDate: '2026-04-27' }),
      mk({ id: 'c', accrualDate: '2026-04-28' }),
    ];
    expect(accrualsForDate(rows, '2026-04-27').map(r => r.id)).toEqual(['b']);
  });
  it('returns empty array when no match', () => {
    expect(accrualsForDate([], '2026-04-27')).toEqual([]);
  });
});

describe('summarizeDay', () => {
  it('returns zeros for empty input', () => {
    expect(summarizeDay([])).toEqual({ admin: 0, master: 0, total: 0 });
  });
  it('sums by roleKind', () => {
    const rows = [
      mk({ employeeId: 'ivan',   roleKind: 'admin',  amount: 1500 }),
      mk({ employeeId: 'ivan',   roleKind: 'master', amount: 2000 }),
      mk({ employeeId: 'bill',   roleKind: 'master', amount: 1800 }),
      mk({ employeeId: 'sergey', roleKind: 'admin',  amount: 3500 }),
    ];
    expect(summarizeDay(rows)).toEqual({ admin: 5000, master: 3800, total: 8800 });
  });
});

describe('isLockedByPayout', () => {
  it('returns false when payoutId is undefined', () => {
    expect(isLockedByPayout(mk({ payoutId: undefined }), [])).toBe(false);
  });
  it('returns false when payoutId set but not in payouts list', () => {
    expect(isLockedByPayout(mk({ payoutId: 'p1' }), [{ id: 'p2' }])).toBe(false);
  });
  it('returns true when payoutId matches an entry in payouts', () => {
    expect(isLockedByPayout(mk({ payoutId: 'p1' }), [{ id: 'p1' }, { id: 'p2' }])).toBe(true);
  });
});

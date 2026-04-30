/**
 * Pure helpers for the daily accruals journal. No state, no DOM, no I/O.
 * Used by Journal.tsx and JournalDayRow.tsx; unit-tested in journal.test.ts.
 */

import type { SalaryAccrual } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Format a Date as YYYY-MM-DD using local-timezone components.
 *  Used for both the date picker value and the `accrualDate` field. */
export function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Add N days (can be negative) to a YYYY-MM-DD string and return a new
 *  YYYY-MM-DD. Operates in local TZ to match formatDateInput. */
export function addDays(yyyymmdd: string, n: number): string {
  const [y, m, day] = yyyymmdd.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + n);
  return formatDateInput(d);
}

/** Filter accruals matching exactly the given date string. */
export function accrualsForDate(
  all: SalaryAccrual[], date: string,
): SalaryAccrual[] {
  return all.filter(a => a.accrualDate === date);
}

/** Sum a list of accruals by roleKind. Used for the day-total footer
 *  and (later) for the D-2 payout preview. */
export function summarizeDay(accruals: SalaryAccrual[]): {
  admin: number; master: number; total: number;
} {
  let admin = 0, master = 0;
  for (const a of accruals) {
    if (a.roleKind === 'admin')  admin  += a.amount;
    if (a.roleKind === 'master') master += a.amount;
  }
  return { admin, master, total: admin + master };
}

/** A row is locked when it points at a payout that exists in the given list. */
export function isLockedByPayout(
  accrual: SalaryAccrual,
  payouts: { id: string }[],
): boolean {
  if (!accrual.payoutId) return false;
  return payouts.some(p => p.id === accrual.payoutId);
}

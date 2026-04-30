import { describe, it, expect, beforeEach } from 'vitest';
import {
  unpaidSummary, previewPayout, closePayout, rollbackPayout,
} from './payout';
import { accrualsStore, deductionsStore, payoutsStore, resetAll } from './store';
import type { SalaryAccrual, Deduction } from './types';

const mkAccrual = (over: Partial<SalaryAccrual>): SalaryAccrual => ({
  id: 'a' + Math.random().toString(36).slice(2, 8),
  employeeId: 'ivan',
  accrualDate: '2026-04-10',
  roleKind: 'master',
  amount: 1000,
  createdAt: '2026-04-10T10:00:00.000Z',
  ...over,
});

const mkDeduction = (over: Partial<Deduction>): Deduction => ({
  id: 'd' + Math.random().toString(36).slice(2, 8),
  employeeId: 'ivan',
  type: 'advance',
  amount: 500,
  givenAt: '2026-04-12T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  resetAll();
});

describe('unpaidSummary', () => {
  it('returns zeros when stores are empty', () => {
    expect(unpaidSummary('ivan', [], [])).toEqual({
      total: 0, accrualsTotal: 0, adminTotal: 0, masterTotal: 0, deductionsTotal: 0,
    });
  });

  it('splits accruals by roleKind', () => {
    const accruals = [
      mkAccrual({ employeeId: 'ivan', roleKind: 'admin',  amount: 1500 }),
      mkAccrual({ employeeId: 'ivan', roleKind: 'master', amount: 2000 }),
      mkAccrual({ employeeId: 'bill', roleKind: 'master', amount: 999 }),
    ];
    expect(unpaidSummary('ivan', accruals, [])).toEqual({
      total: 3500, accrualsTotal: 3500, adminTotal: 1500, masterTotal: 2000, deductionsTotal: 0,
    });
  });

  it('subtracts advances from total', () => {
    const accruals = [mkAccrual({ employeeId: 'ivan', amount: 1000 })];
    const deductions = [mkDeduction({ employeeId: 'ivan', amount: 300 })];
    expect(unpaidSummary('ivan', accruals, deductions)).toEqual({
      total: 700, accrualsTotal: 1000, adminTotal: 0, masterTotal: 1000, deductionsTotal: 300,
    });
  });

  it('excludes already-paid rows (payoutId set)', () => {
    const accruals = [
      mkAccrual({ amount: 1000 }),
      mkAccrual({ amount: 5000, payoutId: 'p1' }),
    ];
    const deductions = [
      mkDeduction({ amount: 200 }),
      mkDeduction({ amount: 999, payoutId: 'p1' }),
    ];
    expect(unpaidSummary('ivan', accruals, deductions).total).toBe(800);
  });
});

describe('previewPayout', () => {
  it('filters strictly by date window (inclusive)', () => {
    const accruals = [
      mkAccrual({ id: 'a1', accrualDate: '2026-04-09', amount: 100 }),
      mkAccrual({ id: 'a2', accrualDate: '2026-04-10', amount: 200 }),
      mkAccrual({ id: 'a3', accrualDate: '2026-04-15', amount: 300 }),
      mkAccrual({ id: 'a4', accrualDate: '2026-04-16', amount: 400 }),
    ];
    const r = previewPayout('ivan', '2026-04-10', '2026-04-15', accruals, []);
    expect(r.inWindow.accruals.map(a => a.id)).toEqual(['a2', 'a3']);
    expect(r.totals.accrualsTotal).toBe(500);
  });

  it('excludes already-paid rows from window', () => {
    const accruals = [
      mkAccrual({ accrualDate: '2026-04-12', amount: 100 }),
      mkAccrual({ accrualDate: '2026-04-12', amount: 200, payoutId: 'p1' }),
    ];
    const r = previewPayout('ivan', '2026-04-10', '2026-04-15', accruals, []);
    expect(r.totals.accrualsTotal).toBe(100);
  });

  it('computes net = accruals - deductions, signed', () => {
    const accruals = [mkAccrual({ accrualDate: '2026-04-12', amount: 1000 })];
    const deductions = [mkDeduction({ givenAt: '2026-04-12T08:00:00.000Z', amount: 1500 })];
    const r = previewPayout('ivan', '2026-04-10', '2026-04-15', accruals, deductions);
    expect(r.totals.net).toBe(-500);
  });
});

describe('closePayout', () => {
  it('persists payout, sets payoutId on linked rows, leaves outsiders alone', () => {
    accrualsStore.upsert({
      employeeId: 'ivan', accrualDate: '2026-04-12', roleKind: 'master', amount: 1000,
    });
    accrualsStore.upsert({
      employeeId: 'ivan', accrualDate: '2026-04-20', roleKind: 'master', amount: 9999,
    });
    deductionsStore.upsert({
      employeeId: 'ivan', type: 'advance', amount: 300, givenAt: '2026-04-13T10:00:00.000Z',
    });

    const payout = closePayout({
      employeeId: 'ivan',
      periodStart: '2026-04-10',
      periodEnd: '2026-04-15',
      paidAt: '2026-04-15T18:00:00.000Z',
      note: 'H1',
    });

    expect(payoutsStore.list()).toHaveLength(1);
    expect(payout.totalAmount).toBe(700);
    expect(payout.note).toBe('H1');

    const accruals = accrualsStore.list();
    const inWindow = accruals.find(a => a.accrualDate === '2026-04-12');
    const outside  = accruals.find(a => a.accrualDate === '2026-04-20');
    expect(inWindow?.payoutId).toBe(payout.id);
    expect(outside?.payoutId).toBeUndefined();

    const deductions = deductionsStore.list();
    expect(deductions[0].payoutId).toBe(payout.id);
  });

  it('totalAmount equals previewPayout.totals.net for the same window', () => {
    accrualsStore.upsert({
      employeeId: 'ivan', accrualDate: '2026-04-12', roleKind: 'admin', amount: 1500,
    });
    accrualsStore.upsert({
      employeeId: 'ivan', accrualDate: '2026-04-13', roleKind: 'master', amount: 2000,
    });
    deductionsStore.upsert({
      employeeId: 'ivan', type: 'advance', amount: 1000, givenAt: '2026-04-12T10:00:00.000Z',
    });

    const preview = previewPayout(
      'ivan', '2026-04-10', '2026-04-15',
      accrualsStore.list(), deductionsStore.list(),
    );
    const payout = closePayout({
      employeeId: 'ivan',
      periodStart: '2026-04-10',
      periodEnd: '2026-04-15',
      paidAt: '2026-04-15T18:00:00.000Z',
    });

    expect(payout.totalAmount).toBe(preview.totals.net);
  });
});

describe('rollbackPayout', () => {
  it('removes payout and clears payoutId from linked rows', () => {
    accrualsStore.upsert({
      employeeId: 'ivan', accrualDate: '2026-04-12', roleKind: 'master', amount: 1000,
    });
    deductionsStore.upsert({
      employeeId: 'ivan', type: 'advance', amount: 300, givenAt: '2026-04-13T10:00:00.000Z',
    });
    const payout = closePayout({
      employeeId: 'ivan',
      periodStart: '2026-04-10',
      periodEnd: '2026-04-15',
      paidAt: '2026-04-15T18:00:00.000Z',
    });

    rollbackPayout(payout.id);

    expect(payoutsStore.list()).toHaveLength(0);
    expect(accrualsStore.list()[0].payoutId).toBeUndefined();
    expect(deductionsStore.list()[0].payoutId).toBeUndefined();
  });

  it('is idempotent for non-existent ids', () => {
    expect(() => rollbackPayout('does-not-exist')).not.toThrow();
    expect(payoutsStore.list()).toHaveLength(0);
  });
});

describe('fines', () => {
  it('fines count toward deductionsTotal', () => {
    const accruals = [mkAccrual({ amount: 1000 })];
    const deductions = [mkDeduction({ type: 'fine', amount: 200 })];
    expect(unpaidSummary('ivan', accruals, deductions).deductionsTotal).toBe(200);
  });

  it('previewPayout sums advances + fines together', () => {
    const accruals = [mkAccrual({ accrualDate: '2026-04-12', amount: 1000 })];
    const deductions = [
      mkDeduction({ givenAt: '2026-04-12T10:00:00.000Z', type: 'advance', amount: 300 }),
      mkDeduction({ givenAt: '2026-04-13T10:00:00.000Z', type: 'fine', amount: 200 }),
    ];
    const r = previewPayout('ivan', '2026-04-10', '2026-04-15', accruals, deductions);
    expect(r.totals.deductionsTotal).toBe(500);
    expect(r.totals.net).toBe(500);
  });
});

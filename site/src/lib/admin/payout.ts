/**
 * D-2 helpers for the payout flow. `unpaidSummary` and `previewPayout` are
 * pure functions; `closePayout` and `rollbackPayout` mutate the stores in
 * a controlled sequence. In project C all four either become pure
 * functions over Supabase result sets, or thin wrappers around RPCs.
 */

import type { SalaryAccrual, Deduction, SalaryPayout, EmployeeId } from './types';
import { accrualsStore, deductionsStore, payoutsStore } from './store';

/* ── unpaidSummary ────────────────────────────────────────────────── */

export function unpaidSummary(
  employeeId: EmployeeId,
  accruals: SalaryAccrual[],
  deductions: Deduction[],
): {
  total: number;
  accrualsTotal: number;
  adminTotal: number;
  masterTotal: number;
  deductionsTotal: number;
} {
  let adminTotal = 0, masterTotal = 0, deductionsTotal = 0;
  for (const a of accruals) {
    if (a.employeeId !== employeeId) continue;
    if (a.payoutId) continue;
    if (a.roleKind === 'admin')  adminTotal  += a.amount;
    if (a.roleKind === 'master') masterTotal += a.amount;
  }
  for (const d of deductions) {
    if (d.employeeId !== employeeId) continue;
    if (d.payoutId) continue;
    deductionsTotal += d.amount;
  }
  const accrualsTotal = adminTotal + masterTotal;
  return {
    total: accrualsTotal - deductionsTotal,
    accrualsTotal, adminTotal, masterTotal, deductionsTotal,
  };
}

/* ── previewPayout ────────────────────────────────────────────────── */

const dateOf = (iso: string) => iso.slice(0, 10);

export function previewPayout(
  employeeId: EmployeeId,
  periodStart: string,
  periodEnd: string,
  accruals: SalaryAccrual[],
  deductions: Deduction[],
): {
  inWindow: { accruals: SalaryAccrual[]; deductions: Deduction[] };
  totals: {
    adminTotal: number;
    masterTotal: number;
    accrualsTotal: number;
    deductionsTotal: number;
    net: number;
  };
} {
  const accrualsInWindow = accruals.filter(a =>
    a.employeeId === employeeId &&
    !a.payoutId &&
    a.accrualDate >= periodStart &&
    a.accrualDate <= periodEnd
  );
  const deductionsInWindow = deductions.filter(d =>
    d.employeeId === employeeId &&
    !d.payoutId &&
    dateOf(d.givenAt) >= periodStart &&
    dateOf(d.givenAt) <= periodEnd
  );

  let adminTotal = 0, masterTotal = 0;
  for (const a of accrualsInWindow) {
    if (a.roleKind === 'admin')  adminTotal  += a.amount;
    if (a.roleKind === 'master') masterTotal += a.amount;
  }
  const accrualsTotal = adminTotal + masterTotal;
  const deductionsTotal = deductionsInWindow.reduce((s, d) => s + d.amount, 0);

  return {
    inWindow: { accruals: accrualsInWindow, deductions: deductionsInWindow },
    totals: {
      adminTotal, masterTotal, accrualsTotal, deductionsTotal,
      net: accrualsTotal - deductionsTotal,
    },
  };
}

/* ── closePayout ──────────────────────────────────────────────────── */

export function closePayout(args: {
  employeeId: EmployeeId;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  note?: string;
}): SalaryPayout {
  const accruals = accrualsStore.list();
  const deductions = deductionsStore.list();

  const preview = previewPayout(
    args.employeeId, args.periodStart, args.periodEnd, accruals, deductions,
  );

  const payout = payoutsStore.upsert({
    employeeId:  args.employeeId,
    periodStart: args.periodStart,
    periodEnd:   args.periodEnd,
    paidAt:      args.paidAt,
    totalAmount: preview.totals.net,
    note:        args.note,
  });

  for (const a of preview.inWindow.accruals) {
    accrualsStore.upsert({ ...a, payoutId: payout.id });
  }
  for (const d of preview.inWindow.deductions) {
    deductionsStore.upsert({ ...d, payoutId: payout.id });
  }

  return payout;
}

/* ── rollbackPayout ───────────────────────────────────────────────── */

export function rollbackPayout(payoutId: string): void {
  const accruals = accrualsStore.list();
  for (const a of accruals) {
    if (a.payoutId === payoutId) {
      accrualsStore.upsert({ ...a, payoutId: undefined });
    }
  }
  const deductions = deductionsStore.list();
  for (const d of deductions) {
    if (d.payoutId === payoutId) {
      deductionsStore.upsert({ ...d, payoutId: undefined });
    }
  }
  payoutsStore.remove(payoutId);
}

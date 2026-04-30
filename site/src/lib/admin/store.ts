/**
 * Admin data store — localStorage-backed for the offline prototype.
 *
 * The interface is intentionally shaped to match a Supabase REST/RLS surface:
 * each entity has list/get/upsert/remove. When a real Supabase project lands
 * we replace the body of these functions with `supabase.from(...)` calls and
 * the UI doesn't change.
 *
 * Storage layout:
 *   localStorage["autolife:admin:<entity>"] = JSON<Array<T>>
 */

import type {
  AppointmentRecord,
  ShiftPayment,
  Deduction,
  SalaryAdjustment,
  CommissionRule,
  SalaryAccrual,
  SalaryPayout,
} from './types';

const KEY = (e: string) => `autolife:admin:${e}`;

function readArr<T>(entity: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY(entity));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}
function writeArr<T>(entity: string, rows: T[]): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY(entity), JSON.stringify(rows)); } catch { /* quota? */ }
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

/* ── Appointments ─────────────────────────────────────────────────── */

export const appointmentsStore = {
  list(): AppointmentRecord[] { return readArr<AppointmentRecord>('appointments'); },
  upsert(rec: Omit<AppointmentRecord, 'id'> & { id?: string }): AppointmentRecord {
    const all = readArr<AppointmentRecord>('appointments');
    const id = rec.id ?? uid();
    const next: AppointmentRecord = { ...rec, id };
    const i = all.findIndex(a => a.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('appointments', all);
    return next;
  },
  remove(id: string) {
    writeArr('appointments', readArr<AppointmentRecord>('appointments').filter(a => a.id !== id));
  },
  /** Mark a booking completed and stamp completedAt. */
  complete(id: string, when: string = new Date().toISOString()) {
    const all = readArr<AppointmentRecord>('appointments');
    const i = all.findIndex(a => a.id === id);
    if (i < 0) return;
    all[i] = { ...all[i], status: 'completed', completedAt: when };
    writeArr('appointments', all);
  },
};

/* ── Shift payments (admin-shift workers) ─────────────────────────── */

export const shiftsStore = {
  list(): ShiftPayment[] { return readArr<ShiftPayment>('shifts'); },
  upsert(rec: Omit<ShiftPayment, 'id'> & { id?: string }): ShiftPayment {
    const all = readArr<ShiftPayment>('shifts');
    const id = rec.id ?? uid();
    const next: ShiftPayment = { ...rec, id };
    const i = all.findIndex(s => s.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('shifts', all);
    return next;
  },
  remove(id: string) {
    writeArr('shifts', readArr<ShiftPayment>('shifts').filter(s => s.id !== id));
  },
};

/* ── Deductions (per-employee ledger: advances + fines) ───────────── */

function migrateAdvancesIfNeeded(): void {
  if (typeof window === 'undefined') return;
  const oldKey = 'autolife:admin:advances';
  const newKey = 'autolife:admin:deductions';
  if (window.localStorage.getItem(newKey) !== null) return;
  const oldRaw = window.localStorage.getItem(oldKey);
  if (!oldRaw) return;
  try {
    const old = JSON.parse(oldRaw) as Array<Omit<Deduction, 'type'>>;
    const migrated = old.map(d => ({ ...d, type: 'advance' as const }));
    window.localStorage.setItem(newKey, JSON.stringify(migrated));
    window.localStorage.removeItem(oldKey);
  } catch { /* corrupted, leave alone */ }
}

export const deductionsStore = {
  list(): Deduction[] {
    migrateAdvancesIfNeeded();
    return readArr<Deduction>('deductions');
  },
  listByType(type: 'advance' | 'fine'): Deduction[] {
    return this.list().filter(d => d.type === type);
  },
  upsert(rec: Omit<Deduction, 'id'> & { id?: string }): Deduction {
    const all = readArr<Deduction>('deductions');
    const id = rec.id ?? uid();
    const next: Deduction = { ...rec, id };
    const i = all.findIndex(a => a.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('deductions', all);
    return next;
  },
  remove(id: string) {
    writeArr('deductions', readArr<Deduction>('deductions').filter(a => a.id !== id));
  },
};

/* ── Salary adjustments (bonuses / fines on master periods) ───────── */

export const adjustmentsStore = {
  list(): SalaryAdjustment[] { return readArr<SalaryAdjustment>('adjustments'); },
  upsert(rec: Omit<SalaryAdjustment, 'id'> & { id?: string }): SalaryAdjustment {
    const all = readArr<SalaryAdjustment>('adjustments');
    const id = rec.id ?? uid();
    const next: SalaryAdjustment = { ...rec, id };
    const i = all.findIndex(a => a.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('adjustments', all);
    return next;
  },
  remove(id: string) {
    writeArr('adjustments', readArr<SalaryAdjustment>('adjustments').filter(a => a.id !== id));
  },
};

/* ── Daily accruals (D-1 journal) ─────────────────────────────────── */

/** Store for `salary_accruals`. Same surface as advancesStore so the
 *  body swaps to supabase.from('salary_accruals') in project C without
 *  touching consumers. */
export const accrualsStore = {
  list(): SalaryAccrual[] { return readArr<SalaryAccrual>('accruals'); },

  listForDate(date: string): SalaryAccrual[] {
    return this.list().filter(a => a.accrualDate === date);
  },

  listForEmployee(employeeId: string): SalaryAccrual[] {
    return this.list().filter(a => a.employeeId === employeeId);
  },

  /** Match by `id` if provided; otherwise by the (employeeId, accrualDate,
   *  roleKind) tuple — re-typing the same field replaces, not appends. */
  upsert(rec: Omit<SalaryAccrual, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): SalaryAccrual {
    const all = readArr<SalaryAccrual>('accruals');
    const id = rec.id ?? all.find(a =>
      a.employeeId === rec.employeeId &&
      a.accrualDate === rec.accrualDate &&
      a.roleKind === rec.roleKind
    )?.id ?? uid();
    const next: SalaryAccrual = {
      ...rec,
      id,
      createdAt: rec.createdAt ?? new Date().toISOString(),
    };
    const i = all.findIndex(a => a.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('accruals', all);
    return next;
  },

  remove(id: string) {
    writeArr('accruals', readArr<SalaryAccrual>('accruals').filter(a => a.id !== id));
  },
};

/* ── Salary payouts (D-2) ─────────────────────────────────────────── */

/** Store for `salary_payouts`. In project C, body swaps to
 *  supabase.rpc('close_payout', ...) for inserts and
 *  supabase.from('salary_payouts').delete() for rollback. */
export const payoutsStore = {
  list(): SalaryPayout[] { return readArr<SalaryPayout>('payouts'); },

  listForEmployee(employeeId: string): SalaryPayout[] {
    return this.list().filter(p => p.employeeId === employeeId);
  },

  upsert(rec: Omit<SalaryPayout, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): SalaryPayout {
    const all = readArr<SalaryPayout>('payouts');
    const id = rec.id ?? uid();
    const next: SalaryPayout = {
      ...rec,
      id,
      createdAt: rec.createdAt ?? new Date().toISOString(),
    };
    const i = all.findIndex(p => p.id === id);
    if (i >= 0) all[i] = next; else all.unshift(next);
    writeArr('payouts', all);
    return next;
  },

  remove(id: string) {
    writeArr('payouts', readArr<SalaryPayout>('payouts').filter(p => p.id !== id));
  },
};

/* ── Commission rules ─────────────────────────────────────────────── */

const DEFAULT_COMMISSION: CommissionRule = { percent: 35 };

export const commissionStore = {
  list(): CommissionRule[] {
    const arr = readArr<CommissionRule>('commission');
    return arr.length ? arr : [DEFAULT_COMMISSION];
  },
  set(rules: CommissionRule[]) { writeArr('commission', rules); },
  /** Resolve commission for a given service slug — picks the most specific
   *  rule that matches; falls back to default 35%. */
  resolve(serviceSlug?: string): { percent?: number; fixedAmount?: number } {
    const rules = this.list();
    const specific = rules.find(r => r.serviceSlug === serviceSlug);
    return specific ?? rules.find(r => !r.serviceSlug) ?? DEFAULT_COMMISSION;
  },
};

/* ── Demo seeder — populates a small dataset on first open ─────────── */

export function seedIfEmpty() {
  if (typeof window === 'undefined') return;
  const flag = window.localStorage.getItem('autolife:admin:seeded');
  if (flag) return;

  const today = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(today); d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };

  // Sample appointments — last 14 days
  const apps: AppointmentRecord[] = [
    {
      id: uid(), customerName: 'Алексей М.', customerPhone: '+7 903 555 12 34',
      carBrand: 'Mercedes', carModel: 'S 580', serviceName: 'Полировка кузова',
      servicePrice: 25000, masterId: 'ivan',
      slotStart: iso(-10), status: 'completed', completedAt: iso(-10),
      createdAt: iso(-12),
    },
    {
      id: uid(), customerName: 'Светлана К.', customerPhone: '+7 916 222 88 55',
      carBrand: 'BMW', carModel: 'M5', serviceName: 'Керамическое покрытие',
      servicePrice: 30000, masterId: 'bill',
      slotStart: iso(-7), status: 'completed', completedAt: iso(-7),
      createdAt: iso(-9),
    },
    {
      id: uid(), customerName: 'Игорь П.', customerPhone: '+7 925 100 33 22',
      carBrand: 'Audi', carModel: 'Q8', serviceName: 'Химчистка салона',
      servicePrice: 18000, masterId: 'roman',
      slotStart: iso(-4), status: 'completed', completedAt: iso(-4),
      createdAt: iso(-6),
    },
    {
      id: uid(), customerName: 'Михаил С.', customerPhone: '+7 985 777 14 09',
      carBrand: 'Porsche', carModel: 'Cayenne', serviceName: 'Шиномонтаж',
      servicePrice: 4500, masterId: 'vladimir',
      slotStart: iso(-2), status: 'completed', completedAt: iso(-2),
      createdAt: iso(-3),
    },
    {
      id: uid(), customerName: 'Дмитрий В.', customerPhone: '+7 977 040 50 60',
      carBrand: 'Lexus', carModel: 'LX 600', serviceName: 'Антидождь на стёкла',
      servicePrice: 3500, masterId: 'alexander',
      slotStart: iso(1), status: 'confirmed',
      createdAt: iso(-1),
    },
    {
      id: uid(), customerName: 'Анна Б.', customerPhone: '+7 919 333 21 88',
      carBrand: 'Volvo', carModel: 'XC90', serviceName: 'Полировка фар',
      servicePrice: 2000, masterId: null,
      slotStart: iso(2), status: 'new',
      createdAt: iso(0),
    },
  ];
  appointmentsStore.list(); // ensures key exists
  writeArr('appointments', apps);

  // Sample admin shifts (Сергей)
  const shifts: ShiftPayment[] = [
    { id: uid(), employeeId: 'sergey', date: iso(-10).slice(0,10), shiftAmount: 3500, bonusAmount: 0,    paidAt: iso(-10) },
    { id: uid(), employeeId: 'sergey', date: iso(-7).slice(0,10),  shiftAmount: 3500, bonusAmount: 500,  paidAt: iso(-7) },
    { id: uid(), employeeId: 'sergey', date: iso(-4).slice(0,10),  shiftAmount: 3500, bonusAmount: 0,    paidAt: iso(-4) },
    { id: uid(), employeeId: 'ivan',   date: iso(-3).slice(0,10),  shiftAmount: 3800, bonusAmount: 0,    paidAt: iso(-3), note: 'смена админа' },
  ];
  writeArr('shifts', shifts);

  // Деморежим: удержания не предустанавливаются
  writeArr('deductions', []);

  window.localStorage.setItem('autolife:admin:seeded', '1');
}

export function resetAll() {
  if (typeof window === 'undefined') return;
  ['appointments', 'shifts', 'deductions', 'adjustments', 'accruals', 'payouts', 'commission', 'seeded'].forEach(k =>
    window.localStorage.removeItem(KEY(k))
  );
}

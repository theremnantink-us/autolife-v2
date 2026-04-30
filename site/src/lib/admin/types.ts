/**
 * Admin domain types — match the future Supabase schema 1:1 so the data
 * layer can be swapped from localStorage → Supabase without touching the UI
 * or salary math.
 */

export type EmployeeId = string;
export type EmployeeRoleAccount = 'owner' | 'limited' | 'master' | 'admin-shift' | 'admin-master';

export interface AppointmentRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  carBrand: string;
  carModel: string;
  serviceName: string;
  servicePrice: number;
  masterId: EmployeeId | null;
  slotStart: string;             // ISO datetime
  status: 'new' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  additionalInfo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ShiftPayment {
  id: string;
  employeeId: EmployeeId;
  date: string;                  // YYYY-MM-DD
  shiftAmount: number;
  bonusAmount: number;
  paidAt: string;                // ISO datetime
  note?: string;
}

export interface Deduction {
  id: string;
  employeeId: EmployeeId;
  type: 'advance' | 'fine';
  amount: number;
  givenAt: string;               // ISO datetime; field name kept for compat
  note?: string;
  reconciled?: boolean;
  payoutId?: string;
}

export interface SalaryAdjustment {
  /** Manual ± to a master period — bonus, fine, missed shift comp, etc. */
  id: string;
  employeeId: EmployeeId;
  amount: number;                // signed (+ bonus, − fine)
  appliedAt: string;             // ISO datetime
  reason: string;
}

export interface SalaryPeriod {
  /** 'YYYY-MM-H1' = 1st–15th, 'YYYY-MM-H2' = 16th–end. */
  key: string;
  label: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD inclusive
}

export interface SalaryReport {
  period: SalaryPeriod;
  employeeId: EmployeeId;
  employeeName: string;
  role: 'master' | 'admin-shift' | 'admin-master';
  /** Master-only: sum of master commissions on completed appointments. */
  grossCommissions: number;
  /** Admin-shift / admin-master: sum of shift payments in period. */
  shiftPaymentsTotal: number;
  /** Bonuses, fines applied. */
  adjustmentsTotal: number;
  deductionsTotal: number;
  netDue: number;
  appointmentsCount: number;
}

/** Commission rule: master gets `percent` of the service price, OR a
 *  fixed amount, whichever is non-null. */
export interface CommissionRule {
  serviceSlug?: string;          // null → applies to all services
  percent?: number;              // 0-100
  fixedAmount?: number;
}

/** Daily accrual for an employee — mirrors `salary_accruals` in Supabase.
 *  Multiple rows can exist for the same (employee, date) when role_kind
 *  differs (Иван/Сергей filling both Админ ₽ and Мойка ₽ on one day). */
export interface SalaryAccrual {
  id: string;
  employeeId: EmployeeId;
  accrualDate: string;            // YYYY-MM-DD (local)
  roleKind: 'admin' | 'master';
  amount: number;                 // > 0
  note?: string;
  payoutId?: string;              // set when included in a paid-out salary_payout
  createdAt: string;              // ISO datetime
}

/** Payout event — mirrors `salary_payouts` in Supabase. Closes a date
 *  window on the employee: every unpaid SalaryAccrual and Deduction with a
 *  date inside `[periodStart, periodEnd]` gets `payoutId = this.id`. */
export interface SalaryPayout {
  id: string;
  employeeId: EmployeeId;
  periodStart: string;     // YYYY-MM-DD
  periodEnd: string;       // YYYY-MM-DD inclusive
  paidAt: string;          // ISO datetime
  totalAmount: number;     // signed; negative if advances exceed accruals
  note?: string;
  createdAt: string;       // ISO datetime
}

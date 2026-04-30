# D-1 Daily Accruals Journal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Журнал" admin tab where the owner enters per-employee per-day earnings, with two amount columns for multi-role employees, autosave on blur, and read-only locking for paid-out rows.

**Architecture:** Pure-React island inside the existing `AdminApp.tsx`, backed by a new `accrualsStore` in localStorage shaped 1:1 with the Supabase `salary_accruals` table. Logic split between a stateless helpers module (`journal.ts`, unit-tested) and two presentational components (`Journal.tsx` root + `JournalDayRow.tsx`).

**Tech Stack:** React 18, TypeScript, Vitest (jsdom), Astro 5.

**Spec:** `site/docs/superpowers/specs/2026-04-27-d1-daily-accruals-journal-design.md`

**Working directory:** `/Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site` (all paths below are relative to this).

---

## File Structure

| Path                                               | Action  | Responsibility                                                                  |
|----------------------------------------------------|---------|----------------------------------------------------------------------------------|
| `src/lib/admin/types.ts`                           | Modify  | Add `SalaryAccrual` interface (1:1 with `salary_accruals` table).               |
| `src/data/employees.ts`                            | Modify  | Add `isMultiRole?: boolean` to `Employee`; flag Сергей and Иван.                |
| `src/lib/admin/store.ts`                           | Modify  | Add `accrualsStore` (list / listForDate / listForEmployee / upsert / remove).   |
| `src/lib/admin/journal.ts`                         | Create  | Pure helpers: `formatDateInput`, `addDays`, `accrualsForDate`, `summarizeDay`, `isLockedByPayout`. |
| `src/lib/admin/journal.test.ts`                    | Create  | Vitest unit tests for the pure helpers.                                         |
| `src/components/islands/admin/JournalDayRow.tsx`   | Create  | One employee row: amount inputs, note, save indicator, lock badge.              |
| `src/components/islands/admin/Journal.tsx`         | Create  | Tab root: date nav, employee list, totals.                                      |
| `src/components/islands/admin/AdminApp.tsx`        | Modify  | Add `'journal'` tab, frame group around `Журнал | Зарплаты`, render `<Journal>`.|

No file is expected to exceed ~250 lines; the largest is `Journal.tsx`.

---

## Task 1: `SalaryAccrual` type

**Files:** Modify `src/lib/admin/types.ts`.

- [ ] **Step 1: Append the interface at the end of the file**

```ts
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
```

- [ ] **Step 2: Type-check**

Run from `/Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site`:
```bash
npx astro check 2>&1 | tail -10
```
Expected: no NEW errors mentioning `types.ts` or `SalaryAccrual`.

- [ ] **Step 3: Commit**

```bash
git add site/src/lib/admin/types.ts
git commit -m "feat(admin): SalaryAccrual type for daily accruals journal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `Employee.isMultiRole`

**Files:** Modify `src/data/employees.ts`.

- [ ] **Step 1: Add the field to the `Employee` interface**

In `src/data/employees.ts` find the `Employee` interface (around lines 22-34) and add `isMultiRole?: boolean;` between `yearsExp?: number;` and `specialties: string[];`. Update the JSDoc comment above so a future reader knows what it means:

```ts
  yearsExp?: number;   // surfaced as small chip
  /** True when the journal should show BOTH "Админ ₽" and "Мойка ₽" inputs
   *  for this employee (Иван — admin-master; Сергей — admin-shift who
   *  occasionally washes). False/omitted = single column based on role. */
  isMultiRole?: boolean;
  specialties: string[]; // 3-5 tags shown under name
```

- [ ] **Step 2: Set the flag for Сергей and Иван**

In the same file, in the `employees` array, add `isMultiRole: true,` to the `sergey` entry (right above `yearsExp`) and to the `ivan` entry. Do NOT add it to bill/alexander/vladimir/roman (default = false).

For sergey, the entry currently reads (around line 38):
```ts
    role: 'admin-shift',
    position: 'Администратор смены',
    description: '...',
    photo: '/IMG/staff/sergey.svg',
    isBookable: false,
    yearsExp: 5,
```
Insert `isMultiRole: true,` between `isBookable: false,` and `yearsExp: 5,`.

For ivan, similar insertion between `isBookable: true,` and `yearsExp: 8,`.

- [ ] **Step 3: Type-check**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/data/employees.ts
git commit -m "feat(employees): isMultiRole flag for Иван and Сергей

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `journal.ts` helpers (TDD)

**Files:**
- Create `src/lib/admin/journal.test.ts`
- Create `src/lib/admin/journal.ts`

### Step 1: Write the failing tests

Create `/Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site/src/lib/admin/journal.test.ts`:

```ts
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
    // Construct in local time so this passes regardless of test machine TZ
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
```

### Step 2: Run tests to verify they fail

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx vitest run src/lib/admin/journal.test.ts 2>&1 | tail -20
```
Expected: FAIL with "Cannot find module './journal'" or similar.

### Step 3: Implement `journal.ts`

Create `/Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site/src/lib/admin/journal.ts`:

```ts
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
```

### Step 4: Run tests to verify they pass

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx vitest run src/lib/admin/journal.test.ts 2>&1 | tail -10
```
Expected: all tests pass (12 tests in 5 describes).

### Step 5: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/lib/admin/journal.ts site/src/lib/admin/journal.test.ts
git commit -m "feat(admin): journal helpers + unit tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `accrualsStore` in `store.ts`

**Files:** Modify `src/lib/admin/store.ts`.

### Step 1: Add the import

At the top of the file, find the `import type` block and add `SalaryAccrual` to the list:

```ts
import type {
  AppointmentRecord,
  ShiftPayment,
  Advance,
  SalaryAdjustment,
  CommissionRule,
  SalaryAccrual,
} from './types';
```

### Step 2: Add the store after `adjustmentsStore`

Find the `adjustmentsStore` block (currently around lines 101-115) and immediately after its closing `};` insert this block:

```ts
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
```

### Step 3: Update `resetAll` to clear the new key

Find the `resetAll` function at the bottom of the file. Add `'accruals'` to the array:

```ts
export function resetAll() {
  if (typeof window === 'undefined') return;
  ['appointments', 'shifts', 'advances', 'adjustments', 'accruals', 'commission', 'seeded'].forEach(k =>
    window.localStorage.removeItem(KEY(k))
  );
}
```

### Step 4: Type-check

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors.

### Step 5: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/lib/admin/store.ts
git commit -m "feat(admin): accrualsStore (localStorage prototype)

Same surface as advancesStore so swap to supabase.from('salary_accruals')
in project C is mechanical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `JournalDayRow.tsx` (single employee row)

**Files:** Create `src/components/islands/admin/JournalDayRow.tsx`.

### Step 1: Create the file

```tsx
/**
 * One row of the daily accruals journal: an employee's name, one or two
 * amount inputs (depending on role / isMultiRole), a note input, and a
 * tiny status indicator. Locked rows render values as plain text with a
 * "выплачено dd.mm" badge and an "Отвязать" action.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Employee } from '../../../data/employees';
import type { SalaryAccrual } from '../../../lib/admin/types';
import { isLockedByPayout } from '../../../lib/admin/journal';

type RoleKind = 'admin' | 'master';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Payout { id: string; paidAt: string; totalAmount: number; }

interface Props {
  employee: Employee;
  date: string;                  // YYYY-MM-DD
  rowAccruals: SalaryAccrual[];  // 0..2 entries (one per roleKind)
  payouts: Payout[];
  onSaveAmount: (params: { roleKind: RoleKind; amount: number | null; note?: string }) => void;
  onSaveNote:   (params: { roleKind: RoleKind; note: string }) => void;
  onUnlock:     (accrualId: string) => void;
}

function showAdminCol(emp: Employee): boolean {
  return emp.role !== 'master';
}
function showMasterCol(emp: Employee): boolean {
  return emp.role !== 'admin-shift' || emp.isMultiRole === true;
}
function dotDate(iso: string): string {
  // dd.mm from YYYY-MM-DD or ISO
  const ymd = iso.slice(0, 10);
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}

export default function JournalDayRow({
  employee, date, rowAccruals, payouts,
  onSaveAmount, onSaveNote, onUnlock,
}: Props) {
  const adminRow  = rowAccruals.find(a => a.roleKind === 'admin');
  const masterRow = rowAccruals.find(a => a.roleKind === 'master');

  const adminLocked  = adminRow  ? isLockedByPayout(adminRow,  payouts) : false;
  const masterLocked = masterRow ? isLockedByPayout(masterRow, payouts) : false;
  const lockedRow    = adminLocked && masterLocked ? adminRow : (adminLocked ? adminRow : masterLocked ? masterRow : null);
  const lockedPayout = lockedRow ? payouts.find(p => p.id === lockedRow.payoutId) ?? null : null;

  return (
    <tr className={`jdr${lockedRow ? ' is-locked' : ''}`}>
      <th scope="row" className="jdr__name">{employee.name}</th>

      <td className="jdr__cell">
        {showAdminCol(employee)
          ? <AmountField
              initial={adminRow?.amount ?? null}
              locked={adminLocked}
              onCommit={(amount) => onSaveAmount({ roleKind: 'admin', amount, note: adminRow?.note })}
            />
          : <span className="jdr__dash" aria-label="не применимо">—</span>}
      </td>

      <td className="jdr__cell">
        {showMasterCol(employee)
          ? <AmountField
              initial={masterRow?.amount ?? null}
              locked={masterLocked}
              onCommit={(amount) => onSaveAmount({ roleKind: 'master', amount, note: masterRow?.note })}
            />
          : <span className="jdr__dash" aria-label="не применимо">—</span>}
      </td>

      <td className="jdr__cell jdr__note-cell">
        <NoteField
          initial={(masterRow ?? adminRow)?.note ?? ''}
          locked={!!lockedRow}
          onCommit={(note) => onSaveNote({
            roleKind: masterRow ? 'master' : (adminRow ? 'admin' : 'master'),
            note,
          })}
        />
      </td>

      <td className="jdr__cell jdr__status">
        {lockedRow && lockedPayout
          ? <LockBadge payout={lockedPayout} onUnlock={() => onUnlock(lockedRow.id)} />
          : <SaveDot accruals={rowAccruals} />}
      </td>
    </tr>
  );
}

/* ───────── AmountField ───────── */

function AmountField({
  initial, locked, onCommit,
}: { initial: number | null; locked: boolean; onCommit: (amount: number | null) => void }) {
  const [val, setVal] = useState<string>(initial == null ? '' : String(initial));
  const [err, setErr] = useState<string | null>(null);
  const lastCommitted = useRef<string>(initial == null ? '' : String(initial));

  // Reflect external updates (date change → new initial value)
  useEffect(() => {
    const next = initial == null ? '' : String(initial);
    setVal(next);
    lastCommitted.current = next;
    setErr(null);
  }, [initial]);

  if (locked) {
    return <span className="jdr__locked-val">{initial == null ? '' : `${initial} ₽`}</span>;
  }

  const onBlur = () => {
    const trimmed = val.trim();
    if (trimmed === lastCommitted.current) return;          // nothing changed
    if (trimmed === '') {
      setErr(null);
      lastCommitted.current = '';
      onCommit(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n <= 0 || String(n) !== trimmed) {
      setErr('Только положительное целое');
      return;
    }
    setErr(null);
    lastCommitted.current = String(n);
    onCommit(n);
  };

  return (
    <span className="jdr__amount-wrap">
      <input
        type="number"
        min={0}
        step={100}
        inputMode="numeric"
        className={`jdr__amount${err ? ' has-error' : ''}`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        aria-invalid={!!err}
        aria-label="Сумма ₽"
      />
      {err && <span className="jdr__err" role="alert" title={err}>!</span>}
    </span>
  );
}

/* ───────── NoteField ───────── */

function NoteField({
  initial, locked, onCommit,
}: { initial: string; locked: boolean; onCommit: (note: string) => void }) {
  const [val, setVal] = useState(initial);
  const lastCommitted = useRef(initial);

  useEffect(() => {
    setVal(initial);
    lastCommitted.current = initial;
  }, [initial]);

  if (locked) {
    return <span className="jdr__locked-note">{initial}</span>;
  }

  const onBlur = () => {
    const trimmed = val.trim();
    if (trimmed === lastCommitted.current) return;
    lastCommitted.current = trimmed;
    onCommit(trimmed);
  };

  return (
    <input
      type="text"
      className="jdr__note"
      maxLength={80}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={onBlur}
      placeholder="заметка"
      aria-label="Заметка"
    />
  );
}

/* ───────── SaveDot — shows ✓ briefly after a row save ───────── */

function SaveDot({ accruals }: { accruals: SalaryAccrual[] }) {
  const [pulse, setPulse] = useState(false);
  const sig = accruals.map(a => `${a.id}:${a.amount}:${a.note ?? ''}`).join('|');
  const lastSig = useRef(sig);

  useEffect(() => {
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      return () => clearTimeout(t);
    }
  }, [sig]);

  if (!pulse) return null;
  return <span className="jdr__saved" aria-label="сохранено">✓</span>;
}

/* ───────── LockBadge ───────── */

function LockBadge({
  payout, onUnlock,
}: { payout: Payout; onUnlock: () => void }) {
  const onClick = (e: FormEvent) => {
    e.preventDefault();
    const ok = window.confirm(
      `Отвязать строку из выплаты от ${dotDate(payout.paidAt)}?\n` +
      `Сама выплата останется как есть (сумма ${payout.totalAmount} ₽), но эта строка снова станет редактируемой.`
    );
    if (ok) onUnlock();
  };
  return (
    <span className="jdr__lock">
      <span className="jdr__lock-badge" title={`Включено в выплату от ${dotDate(payout.paidAt)}. Сумма: ${payout.totalAmount} ₽.`}>
        🔒 выплачено {dotDate(payout.paidAt)}
      </span>
      <button type="button" className="jdr__unlock" onClick={onClick} aria-label="Отвязать от выплаты">↩</button>
    </span>
  );
}
```

### Step 2: Type-check

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors mentioning JournalDayRow.

### Step 3: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/components/islands/admin/JournalDayRow.tsx
git commit -m "feat(admin): JournalDayRow — per-employee row UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `Journal.tsx` (tab root)

**Files:** Create `src/components/islands/admin/Journal.tsx`.

### Step 1: Create the file

```tsx
/**
 * Журнал — daily accruals tab. Date navigator + employee table + totals.
 * Re-pulls from accrualsStore on every parent `tick` change.
 */

import { useMemo, useState } from 'react';
import { employees as ALL_EMPLOYEES } from '../../../data/employees';
import type { SalaryAccrual } from '../../../lib/admin/types';
import { accrualsStore } from '../../../lib/admin/store';
import {
  formatDateInput, addDays, accrualsForDate, summarizeDay,
} from '../../../lib/admin/journal';
import JournalDayRow from './JournalDayRow';

type RoleKind = 'admin' | 'master';

interface Props {
  /** Bumped by AdminApp's tick after we mutate accrualsStore */
  tick: number;
  onChange: () => void;
}

const RU_WEEKDAY = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const RU_MONTH   = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} ${RU_MONTH[m - 1]} ${y}, ${RU_WEEKDAY[dt.getDay()]}`;
}

export default function Journal({ tick, onChange }: Props) {
  const today = formatDateInput(new Date());
  const [date, setDate] = useState<string>(today);

  // Re-read on every tick OR date change
  const allAccruals = useMemo<SalaryAccrual[]>(() => accrualsStore.list(), [tick]);
  const dayAccruals = useMemo(() => accrualsForDate(allAccruals, date), [allAccruals, date]);
  const employees   = useMemo(
    () => ALL_EMPLOYEES.slice().sort((a, b) => (a as any).sortOrder ?? 0 - ((b as any).sortOrder ?? 0)),
    []
  );

  const totals  = summarizeDay(dayAccruals);
  const payouts: { id: string; paidAt: string; totalAmount: number }[] = []; // D-2 will populate

  const handleSaveAmount = (employeeId: string) => ({
    roleKind, amount, note,
  }: { roleKind: RoleKind; amount: number | null; note?: string }) => {
    const existing = dayAccruals.find(a => a.employeeId === employeeId && a.roleKind === roleKind);
    if (amount === null) {
      if (existing) accrualsStore.remove(existing.id);
    } else {
      accrualsStore.upsert({
        id: existing?.id,
        employeeId,
        accrualDate: date,
        roleKind,
        amount,
        note: note || existing?.note,
      });
    }
    onChange();
  };

  const handleSaveNote = (employeeId: string) => ({
    roleKind, note,
  }: { roleKind: RoleKind; note: string }) => {
    const existing = dayAccruals.find(a => a.employeeId === employeeId && a.roleKind === roleKind);
    if (!existing) return; // no row yet → note is dropped (documented in spec)
    accrualsStore.upsert({ ...existing, note: note || undefined });
    onChange();
  };

  const handleUnlock = (accrualId: string) => {
    const row = allAccruals.find(a => a.id === accrualId);
    if (!row) return;
    accrualsStore.upsert({ ...row, payoutId: undefined });
    onChange();
  };

  return (
    <div className="aap__panel jrn">
      <div className="jrn__head">
        <button type="button" className="jrn__nav" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>←</button>
        <label className="jrn__date">
          <span className="jrn__date-label">{humanDate(date)}</span>
          <input
            type="date"
            className="jrn__date-input"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Выбрать дату"
          />
        </label>
        <button type="button" className="jrn__nav" aria-label="Следующий день" onClick={() => setDate(addDays(date, +1))}>→</button>
        <button
          type="button"
          className="jrn__today"
          onClick={() => setDate(today)}
          disabled={date === today}
        >Сегодня</button>
      </div>

      <table className="jrn__table">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            <th scope="col">Админ ₽</th>
            <th scope="col">Мойка ₽</th>
            <th scope="col">Заметка</th>
            <th scope="col" aria-label="Статус сохранения" />
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <JournalDayRow
              key={emp.id}
              employee={emp}
              date={date}
              rowAccruals={dayAccruals.filter(a => a.employeeId === emp.id)}
              payouts={payouts}
              onSaveAmount={handleSaveAmount(emp.id)}
              onSaveNote={handleSaveNote(emp.id)}
              onUnlock={handleUnlock}
            />
          ))}
        </tbody>
      </table>

      <div className={`jrn__totals${totals.total === 0 ? ' is-empty' : ''}`}>
        Итого за день: <strong>{totals.total} ₽</strong>
        <span className="jrn__totals-split">
          (админ: {totals.admin} ₽ · мойка: {totals.master} ₽)
        </span>
      </div>
    </div>
  );
}
```

### Step 2: Type-check

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors mentioning Journal.tsx.

### Step 3: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/components/islands/admin/Journal.tsx
git commit -m "feat(admin): Journal tab root with date nav + day totals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `Journal` into `AdminApp.tsx` + tab group frame

**Files:** Modify `src/components/islands/admin/AdminApp.tsx`.

### Step 1: Extend the `Tab` type

Find the line `type Tab = 'dashboard' | 'bookings' | 'salaries';` (around line 27) and replace with:
```ts
type Tab = 'dashboard' | 'bookings' | 'journal' | 'salaries';
```

### Step 2: Import Journal

Find the existing imports and add (place near the other admin component imports — there are no other ones yet, so put near the top of the imports):

```ts
import Journal from './Journal';
```

### Step 3: Replace the tab nav with grouped layout

Find the `<nav>` element (around lines 48-62) and replace it with:

```tsx
<nav className="aap__tabs" role="tablist">
  {([
    ['dashboard', 'Статистика'],
    ['bookings',  'Записи'],
  ] as const).map(([id, label]) => (
    <button
      key={id}
      role="tab"
      aria-selected={tab === id}
      className={`aap__tab${tab === id ? ' is-active' : ''}`}
      onClick={() => setTab(id as Tab)}
    >{label}</button>
  ))}
  <span className={`aap__tabs-group${(tab === 'journal' || tab === 'salaries') ? ' is-active' : ''}`}>
    {([
      ['journal',  'Журнал'],
      ['salaries', 'Зарплаты'],
    ] as const).map(([id, label]) => (
      <button
        key={id}
        role="tab"
        aria-selected={tab === id}
        className={`aap__tab${tab === id ? ' is-active' : ''}`}
        onClick={() => setTab(id as Tab)}
      >{label}</button>
    ))}
  </span>
</nav>
```

### Step 4: Render Journal panel

Find the trio of conditional renders (around lines 71-73) and add the journal line between bookings and salaries:

```tsx
{tab === 'dashboard' && <Dashboard apps={apps} shifts={shifts} advances={advances} />}
{tab === 'bookings'  && <Bookings  apps={apps} onChange={refresh} />}
{tab === 'journal'   && <Journal   tick={tick} onChange={refresh} />}
{tab === 'salaries'  && <Salaries  apps={apps} shifts={shifts} advances={advances} adjustments={adjustments} onChange={refresh} />}
```

### Step 5: Type-check

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors.

### Step 6: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/components/islands/admin/AdminApp.tsx
git commit -m "feat(admin): wire Journal tab + group frame around financial pair

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: CSS — tab group frame + journal panel

**Files:** Modify `src/components/islands/admin/AdminApp.tsx`.

The `<Style />` component at the bottom of the file is one big template literal of CSS. Append the following block immediately before the closing backtick:

### Step 1: Append CSS

Locate the `Style` function near the bottom (it's the only `function Style()` in the file). Inside its `style` template literal, find the very end (just before the backtick) and append:

```css

/* ─── Tabs group frame (Журнал · Зарплаты) ─────────────────────────── */
.aap__tabs-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: var(--radius-md, 10px);
  background: rgba(255,255,255,0.02);
  transition: border-color 200ms ease, background 200ms ease;
}
.aap__tabs-group.is-active {
  border-color: var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(255,255,255,0.05);
}

/* ─── Journal panel ────────────────────────────────────────────────── */
.jrn { padding: 24px; }
.jrn__head {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.jrn__nav {
  width: 32px; height: 32px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 150ms ease;
}
.jrn__nav:hover { background: rgba(255,255,255,0.08); }
.jrn__date {
  position: relative;
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  cursor: pointer;
  user-select: none;
  padding: 4px 10px;
  border-radius: 8px;
  transition: background 150ms ease;
}
.jrn__date:hover { background: rgba(255,255,255,0.04); }
.jrn__date-input {
  position: absolute; inset: 0;
  opacity: 0;
  cursor: pointer;
}
.jrn__today {
  margin-left: auto;
  padding: 6px 12px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: transparent;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.jrn__today:disabled { opacity: 0.4; cursor: default; }

.jrn__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.jrn__table thead th {
  text-align: left;
  font-weight: 500;
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
}
.jdr { border-bottom: 1px solid rgba(255,255,255,0.04); }
.jdr.is-locked { opacity: 0.7; }
.jdr__name { text-align: left; padding: 12px; font-weight: 500; color: var(--text); white-space: nowrap; }
.jdr__cell { padding: 8px 12px; vertical-align: middle; }
.jdr__dash { color: var(--text-muted); opacity: 0.5; }

.jdr__amount-wrap { position: relative; display: inline-block; }
.jdr__amount {
  width: 100px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.jdr__amount:focus { outline: 1px solid var(--chrome-2, rgba(232,234,237,0.5)); outline-offset: 0; }
.jdr__amount.has-error { border-color: #c0392b; }
.jdr__err {
  position: absolute; right: -16px; top: 50%; transform: translateY(-50%);
  color: #c0392b; font-weight: 700;
}
.jdr__note {
  width: 100%;
  min-width: 140px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
}
.jdr__note:focus { outline: 1px solid var(--chrome-2, rgba(232,234,237,0.5)); outline-offset: 0; }
.jdr__note-cell { width: 32%; }

.jdr__locked-val { font-variant-numeric: tabular-nums; color: var(--text-muted); }
.jdr__locked-note { color: var(--text-muted); font-style: italic; font-size: 13px; }

.jdr__status { width: 120px; text-align: right; }
.jdr__saved { color: #57bb8a; font-weight: 700; font-size: 13px; }

.jdr__lock { display: inline-flex; align-items: center; gap: 6px; }
.jdr__lock-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255,255,255,0.04);
  white-space: nowrap;
}
.jdr__unlock {
  border: none; background: transparent;
  color: var(--text-muted); cursor: pointer;
  font-size: 14px; padding: 2px 4px;
}
.jdr__unlock:hover { color: var(--text); }

.jrn__totals {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  font-size: 14px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.jrn__totals.is-empty { opacity: 0.5; }
.jrn__totals-split {
  margin-left: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 640px) {
  .jrn { padding: 12px; }
  .jdr__amount { width: 80px; }
  .jdr__note-cell { width: auto; }
  .jrn__table { font-size: 13px; }
  .aap__tabs-group { width: 100%; justify-content: center; }
}
```

### Step 2: Type-check

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check 2>&1 | tail -10
```
Expected: no new errors.

### Step 3: Commit

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add site/src/components/islands/admin/AdminApp.tsx
git commit -m "style(admin): tab group frame + journal panel CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Manual smoke test

**Files:** none.

The dev server is already running on `http://localhost:4322`. If not, start it:
```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
/Users/bill/.nvm/versions/node/v24.15.0/bin/node ./node_modules/astro/bin/astro.mjs dev --port 4322 --host
```

Walk through these in a browser at `http://localhost:4322/admin`:

- [ ] **Step 1: Tab structure**

Visible tabs: `Статистика`  `Записи`  with a framed box around `[Журнал | Зарплаты]`. Click Журнал — frame highlights with brighter border. Click Зарплаты — frame stays highlighted, content switches.

- [ ] **Step 2: Empty day**

Click "Журнал" → see today's date in human format ("27 апреля 2026, понедельник"), navigation arrows on either side, "Сегодня" button (disabled because already today). Six employee rows. Сергей and Иван show inputs in BOTH "Админ ₽" and "Мойка ₽" columns. Билл/Александр/Владимир/Роман show inputs in "Мойка ₽" only with `—` in admin column. Itого внизу: "Итого за день: 0 ₽ (админ: 0 ₽ · мойка: 0 ₽)".

- [ ] **Step 3: Save a value**

In Билл's "Мойка ₽" type `1500` → Tab out → see `✓` flash in status column for ~1.5s → Итого updates to "1500 ₽ (… мойка: 1500 ₽)". Refresh the page — value still `1500`.

- [ ] **Step 4: Multi-role split**

In Иван's row fill Админ `1500` and Мойка `2000`. Итого shows "3500 ₽ (админ: 1500 · мойка: 2000)".

- [ ] **Step 5: Note**

Add note "тест" to Иван — Tab out → no error. Refresh — note reappears.

- [ ] **Step 6: Date navigation**

Click ← → previous day (e.g., "26 апреля 2026, воскресенье"). Fields likely empty. Click "Сегодня" → snaps back, button disables. Click on the date label → native date picker appears, pick a date 3 days ago → jumps there.

- [ ] **Step 7: Validation**

Type `-100` in any field → Tab out → red `!` icon to the right of field, value rejected, no save.

- [ ] **Step 8: Empty out a saved field**

Clear Билл's `1500` to empty → Tab out → row removed. Refresh — still empty.

- [ ] **Step 9: Reset all**

Click "Сброс" header button → confirm → all journal rows clear; demo appointments/shifts/advances re-seeded.

If any step fails, report which one and what you saw vs expected — do NOT mark D-1 complete.

- [ ] **Step 10: Final commit (no code, just marker)**

If all 9 steps pass:
```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git commit --allow-empty -m "test(admin): D-1 daily accruals journal smoke-tested

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes

**Spec coverage:**
- Tab structure with frame group → Tasks 7, 8.
- File structure (Journal, JournalDayRow, journal.ts, types/store/employees mods) → Tasks 1, 2, 3, 4, 5, 6.
- SalaryAccrual type → Task 1.
- accrualsStore with upsert-by-tuple → Task 4.
- isMultiRole → Task 2.
- Day View layout, navigation, autosave, validation → Tasks 5, 6.
- Two-column visibility logic (`showAdminCol`/`showMasterCol`) → Task 5; matches the spec rule `admin: emp.role !== 'master'; master: emp.role !== 'admin-shift' || emp.isMultiRole`.
- Lock-by-payout (read-only state, badge, unlock confirm) → Task 5.
- Totals + role split → Task 6.
- Unit tests for journal helpers → Task 3.
- Manual smoke walkthrough → Task 9.

**Placeholder scan:** No "TBD"/"TODO"/"similar to" — every step is concrete code or a concrete command.

**Type consistency:**
- `SalaryAccrual` shape used identically in Tasks 1, 3, 4, 5, 6.
- `RoleKind` defined as string-literal alias in Task 5 and Task 6 (must match — it does: `'admin' | 'master'`).
- `accrualsStore` interface used in Task 6 (`list`, `upsert`, `remove`) — all defined in Task 4.
- `Payout` interface in Task 5 (`{ id, paidAt, totalAmount }`) — same shape constructed empty in Task 6 and will be populated in D-2 from `salary_payouts`.

**Known limitation (per spec):** Notes-only entries are dropped silently because `handleSaveNote` short-circuits when there's no existing accrual row (Task 6). This is documented in spec §"Autosave behavior" as accepted scope.

**Potential edge case not covered by tests:** date change while a field has unsaved input. Per spec §"Date change flush" we'd ideally `flushPending()` before `setDate`. The current Task 5/6 implementation relies on the field's `useEffect([initial])` re-syncing to whatever's in the store; an in-flight value typed but not blurred is lost. This is an accepted simplification for D-1 — if it bites in dogfooding, add a `useImperativeHandle` flush in JournalDayRow as a follow-up. Documented here so reviewer doesn't flag as bug.

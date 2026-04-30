# D-1 — Дневной журнал начислений

**Date:** 2026-04-27
**Branch:** `redesign-v2`
**Storage:** localStorage (per project D plan; swaps to Supabase in project C).
**Depends on:** project A schema (`salary_accruals.role_kind`).
**Blocks:** D-2 (payouts) consumes the journal data.

## Goal

Add a "Журнал" tab to `/admin` where the owner enters per-employee per-day
earnings by hand. Multi-role employees (Иван — `admin-master`; Сергей —
`admin-shift` who occasionally washes) see two amount fields side-by-side
("Админ ₽" / "Мойка ₽") that map to two `salary_accruals` rows with
distinct `role_kind`. Single-role employees see a single field.

## Decision summary

| Q | Decision |
|---|----------|
| Tab placement | New tab "Журнал" between Записи and Зарплаты, with Журнал+Зарплаты grouped by a frame. |
| Entry view | Day-detail (date picker + ←/→ + per-employee row). |
| Multi-role | Two side-by-side amount fields for `is_multi_role` employees. |
| Save | Autosave on blur; ✓ indicator. |
| Paid-out lock | Read-only with badge; explicit "Отвязать" with confirm. |

## Tab structure

`AdminApp.tsx` `Tab` type extends to `'dashboard' \| 'bookings' \| 'journal' \| 'salaries'`. The tab nav becomes:

```
[Статистика] [Записи]   ┌─[Журнал][Зарплаты]─┐
                        └────────────────────┘
```

The financial group is `<div class="aap__tabs-group">` wrapping the
"Журнал" and "Зарплаты" buttons. CSS: `1px solid var(--border)`,
`border-radius: var(--radius-md)`, faint inset background, padding 4px.
Group highlights when any of its tabs is active (`:has(.is-active)`).

## File structure

| Path                                                  | Action  | Responsibility                                                            |
|-------------------------------------------------------|---------|---------------------------------------------------------------------------|
| `site/src/components/islands/admin/Journal.tsx`        | Create  | Tab root: date nav, employee list, totals.                                |
| `site/src/components/islands/admin/JournalDayRow.tsx`  | Create  | One employee row: amount field(s), note, save indicator, lock badge.      |
| `site/src/lib/admin/journal.ts`                        | Create  | Pure helpers: `accrualsForDate`, `summarizeDay`, `isLockedByPayout`, `formatDateInput`. |
| `site/src/lib/admin/types.ts`                          | Modify  | Add `SalaryAccrual` interface mirroring `salary_accruals` table.          |
| `site/src/lib/admin/store.ts`                          | Modify  | Add `accrualsStore` (list / upsert / remove / listForDate / listForEmployee). |
| `site/src/components/islands/admin/AdminApp.tsx`       | Modify  | New `'journal'` tab, frame group around financial pair, render `<Journal />`. |
| `site/src/data/employees.ts`                           | Modify  | Add `isMultiRole?: boolean` to `Employee`; set true for Сергей and Иван.  |

## Data layer

### `SalaryAccrual` (in `types.ts`)

```ts
export interface SalaryAccrual {
  id: string;
  employeeId: EmployeeId;
  accrualDate: string;            // YYYY-MM-DD
  roleKind: 'admin' | 'master';
  amount: number;                 // > 0
  note?: string;
  payoutId?: string;              // set by D-2 close_payout
  createdAt: string;              // ISO
}
```

### `accrualsStore` (in `store.ts`)

Same shape as `advancesStore`. localStorage key: `autolife:admin:accruals`.

```ts
export const accrualsStore = {
  list(): SalaryAccrual[],
  listForDate(date: string): SalaryAccrual[],          // YYYY-MM-DD
  listForEmployee(employeeId: string): SalaryAccrual[],
  upsert(rec: Omit<SalaryAccrual, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): SalaryAccrual,
  remove(id: string): void,
};
```

`upsert` matches by `id` if provided, else by `(employeeId, accrualDate, roleKind)` tuple — so re-typing the same field replaces, not appends. This guarantees at most one row per `(employee, date, role_kind)` from the journal UI; D-2 may add additional rows with notes (bonuses) via a separate "Add bonus row" affordance — not in D-1 scope.

### `Employee.isMultiRole`

Added to `Employee` interface (default `false`). In `data/employees.ts`:
- `sergey` → `isMultiRole: true`
- `ivan` → `isMultiRole: true`
- others → omit (false).

## Day View — `<Journal>`

### Layout

```
┌─ Журнал начислений ──────────────────────────────────────┐
│  ← [27 апреля 2026, понедельник ▾]  →    [сегодня]        │
│                                                            │
│  Сотрудник     Админ ₽   Мойка ₽   Заметка        статус │
│  ─────────────────────────────────────────────────────── │
│  Сергей        [____]    [____]    [_______]      ✓      │
│  Иван          [____]    [____]    [_______]             │
│  Билл              —     [____]    [_______]      ✓      │
│  Александр         —     [____]    [_______]             │
│  Владимир          —     [____]    [_______]             │
│  Роман             —     [____]    [_______]             │
│                                                            │
│  Итого за день: 0 ₽   (админ: 0 ₽   мойка: 0 ₽)           │
└────────────────────────────────────────────────────────────┘
```

### State

```ts
const [date, setDate] = useState(formatDateInput(new Date())); // YYYY-MM-DD
const accruals = accrualsStore.listForDate(date);              // re-pulled via parent's tick
const payouts: SalaryPayout[] = [];                            // D-1 always empty
const employees = employeesData.filter(e => e.isActive !== false)
                               .sort((a, b) => a.sortOrder - b.sortOrder);
```

### Date navigation

- ← / → buttons: `setDate(addDays(date, -1 | +1))`.
- Date label is a button that opens a native `<input type="date">` overlay.
- "Сегодня" button: `setDate(formatDateInput(new Date()))`. Disabled when already on today.

### Row rendering (per employee)

`<JournalDayRow employee={emp} accruals={rowAccruals} onSave={...} onUnlock={...} />`

- `rowAccruals` = `accruals.filter(a => a.employeeId === emp.id)`. Up to 2 entries (one per role_kind).
- Show "Админ ₽" input if `emp.isMultiRole`, else `—` (gray dash, not focusable).
- "Мойка ₽" input always shown for masters and multi-role; `—` for `admin-shift` only-admin (none of our seeded employees, but keep the conditional symmetric).
  - Concretely: column visibility = `{ admin: emp.role !== 'master', master: emp.role !== 'admin-shift' || emp.isMultiRole }`.
- Note field always shown.
- Save indicator: `idle` (empty) → `saving` (200ms spinner) → `saved` (1.5s green ✓) → `idle`.

### Autosave behavior

For each amount input:

```
onBlur(e):
  const raw = e.target.value.trim();
  const existing = rowAccruals.find(a => a.roleKind === thisRoleKind);

  if (raw === '') {
    if (existing) accrualsStore.remove(existing.id);
    return;
  }

  const amount = parseInt(raw, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    setFieldError(thisRoleKind, 'invalid');
    return;
  }

  setStatus('saving');
  accrualsStore.upsert({
    id: existing?.id,
    employeeId: emp.id,
    accrualDate: date,
    roleKind: thisRoleKind,
    amount,
    note: existing?.note,
  });
  setStatus('saved');
  setTimeout(() => setStatus('idle'), 1500);
  onChange(); // bubble to AdminApp.tick
```

Note input has same flow but only updates `note` on existing rows. If no row yet (both amount fields empty) and user types in note — note is held in component state until first amount entry triggers row creation. (Edge case: noted-without-amount day. Not stored. If owner wants to leave a note for "Иван не работал сегодня" without an amount — they enter `0` is not allowed by `> 0` constraint — so they leave note empty. **Accept this limitation** — bonus rows / notes-only entries are D-2 scope.)

### Tab order

`Tab` walks: Админ → Мойка → Заметка → next employee's first visible field. `Shift+Tab` reverses. `Esc` blurs current field (triggers save).

### Date change flush

When `date` is about to change (← / → / picker / "Сегодня") and any field has an in-flight blur not yet committed: synchronously flush before swapping. Practical implementation: each `JournalDayRow` exposes a `flushPending()` ref method; `Journal` calls all rows' `flushPending()` before `setDate`.

### Totals

```ts
const totals = summarizeDay(accruals);
// { admin: number; master: number; total: number; lines: number }
```

Rendered below table: `Итого за день: <total> ₽   (админ: <admin> ₽   мойка: <master> ₽)`. If `total === 0` show muted style.

## Lock by payout

`isLockedByPayout(accrual, payouts)` returns `true` iff `accrual.payoutId` is set and a matching payout exists in `payouts`.

Locked field: rendered as `<span>` with the value (or empty), gray bg, no border. Lock badge `🔒 выплачено dd.mm` to the right of note column. Hover tooltip: `Включено в выплату от <full date>. Сумма выплаты: <total_amount> ₽.`

"Отвязать" icon button `↩` next to badge → confirm dialog:

> Отвязать строку из выплаты от 14.04?
> Сама выплата останется как есть (сумма 18 500 ₽), но строка снова станет редактируемой. Расхождение будет видно в отчёте «Расхождения» во вкладке Зарплаты.

Confirm → `accrualsStore.upsert({ ...row, payoutId: undefined })`. UI re-renders unlocked.

In D-1 `payouts` array is always empty, so locking never triggers. Logic is wired and tested with a mock payout in unit tests.

## Helpers (`journal.ts`)

```ts
export function formatDateInput(d: Date): string;          // YYYY-MM-DD in local TZ
export function addDays(yyyymmdd: string, n: number): string;
export function accrualsForDate(all: SalaryAccrual[], date: string): SalaryAccrual[];
export function summarizeDay(accruals: SalaryAccrual[]): {
  admin: number;
  master: number;
  total: number;
  lines: number;
};
export function isLockedByPayout(
  accrual: SalaryAccrual,
  payouts: { id: string }[],
): boolean;
```

## Testing

### Unit (vitest if available; otherwise add a minimal vitest config)

`site/tests/admin/journal.test.ts`:

- `formatDateInput` returns `YYYY-MM-DD` in local TZ for `new Date(2026, 3, 27)`.
- `addDays('2026-02-28', 1) === '2026-03-01'`; `addDays('2026-03-01', -1) === '2026-02-28'`.
- `accrualsForDate` filters by `accrualDate` exactly.
- `summarizeDay`: empty array → all zeros. Mixed roles → correct totals.
- `isLockedByPayout`: row with no payoutId → false. Row with payoutId not in list → false. Row with payoutId in list → true.

### Manual smoke (dev server `http://localhost:4322/admin`)

1. Click "Журнал" tab → see today's date, six employees, all empty.
2. Type `1500` in Билл's "Мойка ₽" → blur → spinner → ✓ → reload → value still `1500`.
3. Иван — fill both `1500` and `2000` → totals show `Итого: 3500 (админ: 1500, мойка: 2000)`.
4. Click ← → previous day, fields likely empty (or different).
5. Tab order: focus admin → tab → master → tab → note → tab → next employee.
6. Type `-100` → red icon, no save, value rejected.
7. Reset all data via "Сброс" → journal empties.

## Non-goals

- Payout flow / `close_payout` / payout history (D-2).
- Discrepancies report (D-2).
- Bonus rows / notes-only entries (D-2 — adds an "Add bonus" affordance).
- Monthly grid view (covered by D-2 payout preview range).
- Editing existing "Зарплаты" tab (`shiftsStore` / `adjustmentsStore` reports remain untouched until D-2).
- Removing legacy localStorage keys (`shifts`, `adjustments`) — happens after D-2 covers their functionality.
- Keyboard shortcut for prev/next day (defer until first user friction).
- Display of advances/fines for the day in journal (they aggregate at payout level, not day).

## Future Work

- D-2 needs `journal.ts:summarizeDay` and `accrualsForDate` to preview payouts — ensure they remain stable interfaces.
- C migration: `accrualsStore` body swaps to `supabase.from('salary_accruals')`. The interface contract above is the migration boundary — preserve names and signatures.

## Open Questions (none blocking D-1)

- After dogfooding, decide whether `note` should auto-save independently of amount (currently note rides on amount-row creation). If owner frequently leaves notes-only days, change to: typing in note creates a sentinel amount-0 row with a different `roleKind = 'note'` enum value (would require schema migration in C) — defer until pattern observed.

# D-2 — Поток выплат

**Date:** 2026-04-27
**Branch:** `redesign-v2`
**Storage:** localStorage (D-2 prototype, swaps to Supabase in project C).
**Depends on:** D-1 (`accrualsStore`, `journal.ts`, `SalaryAccrual` type already live).
**Blocks:** D-3 (fines + unified Удержания tab consumes payoutsStore + advance shape).

## Goal

Replace the legacy "Зарплаты" tab with a manual payout flow built on the data
model decided in project A (`salary_payouts` + `close_payout` RPC). The
boss picks an employee from a left list, sees their accumulated unpaid
amount, fills a date range and confirms a payout. Past payouts are listed in
the same panel with rollback and note-edit actions. Advances stay accessible
via a mini-form at the bottom of the right panel until D-3 unifies them with
fines under "Удержания".

## Decision summary (brainstorming 2026-04-27)

| Q | Decision |
|---|----------|
| Layout | **B**: two-panel — left employee list, right selected-employee card. Mobile = swap, no overlay. |
| Form preview | **B**: collapsed details by default; admin/master split shown in the totals header for multi-role employees. |
| History actions | **B**: rollback (`🗑`) and edit-note (`📝`) per payout entry. |
| Bonus rows + discrepancies report | **D**: defer both to D-2.5 mini-cycle. |
| Advances interim placement | **A**: mini-form lives at the bottom of the employee card. |
| `salary.ts` legacy file | Delete. Auto-commission model superseded by manual journal. |

## Layout

### Desktop (≥ 768px)

Two-panel grid inside the existing `aap__panel` container:

```
┌─ Зарплаты ───────────────────────────────────────────────────────┐
│ Список                          │ Карточка сотрудника            │
│ ─────────                       │ ──────────────────             │
│ Сергей           12 500 ₽  →    │ ИВАН                           │
│ Иван      [акт] 17 800 ₽       │ ─ Новая выплата ──             │
│ Билл              8 200 ₽  →    │ ...                            │
│ ...                              │ ─ История выплат ──            │
│                                  │ ...                            │
│                                  │ ─ Выдать аванс ──              │
│                                  │ ...                            │
└──────────────────────────────────────────────────────────────────┘
```

Left column ~320px, right column flex. List item active state matches the
existing `aap__tab.is-active` chrome treatment.

### Mobile (< 768px)

Single-column. Default = list. Tap on employee → right panel takes the full
width with `← Назад` button at the top. No modals, no overlays.

### Empty state

If no employee is selected (initial load), the right panel shows a muted
hint: «← выберите сотрудника, чтобы создать выплату или выдать аванс».

## Data layer

### Types (`src/lib/admin/types.ts`)

Append:

```ts
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
```

Extend existing `Advance`:

```ts
export interface Advance {
  // ...existing fields
  payoutId?: string;       // set when this advance is included in a paid-out salary_payout
}
```

### Store (`src/lib/admin/store.ts`)

Add after `accrualsStore`:

```ts
export const payoutsStore = {
  list(): SalaryPayout[],
  listForEmployee(employeeId: string): SalaryPayout[],
  upsert(rec: Omit<SalaryPayout, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): SalaryPayout,
  remove(id: string): void,
};
```

`resetAll` array gets `'payouts'` added between `'accruals'` and `'commission'`.

### Helpers (`src/lib/admin/payout.ts`, new file)

```ts
import type { SalaryAccrual, Advance, SalaryPayout, EmployeeId } from './types';

export function unpaidSummary(
  employeeId: EmployeeId,
  accruals: SalaryAccrual[],
  advances: Advance[],
): { total: number; accrualsTotal: number; adminTotal: number; masterTotal: number; advancesTotal: number };

export function previewPayout(
  employeeId: EmployeeId,
  periodStart: string, // YYYY-MM-DD
  periodEnd: string,   // YYYY-MM-DD
  accruals: SalaryAccrual[],
  advances: Advance[],
): {
  inWindow: { accruals: SalaryAccrual[]; advances: Advance[] };
  totals: {
    adminTotal: number;
    masterTotal: number;
    accrualsTotal: number;
    advancesTotal: number;
    net: number;
  };
};

export function closePayout(
  args: {
    employeeId: EmployeeId;
    periodStart: string;
    periodEnd: string;
    paidAt: string;
    note?: string;
  },
): SalaryPayout;
// Reads unpaid accruals & advances in window via store, computes net, calls
// payoutsStore.upsert, then accrualsStore.upsert and advancesStore.upsert
// for each linked row to set payoutId. Returns the inserted payout.

export function rollbackPayout(payoutId: string): void;
// 1. accrualsStore.upsert each linked row with payoutId = undefined
// 2. advancesStore.upsert each linked advance with payoutId = undefined
// 3. payoutsStore.remove(payoutId)
```

`closePayout` and `rollbackPayout` are sequenced so a partial-write failure
(quota exceeded mid-way) leaves the store in a recoverable state. On
Supabase (project C) they collapse to single RPC calls, which are
atomic on the DB side.

### Filtering rules

Window inclusion semantics (verbatim, used both in `previewPayout` and
inside `closePayout`):

- `SalaryAccrual` is in window iff `accrualDate >= periodStart` AND `accrualDate <= periodEnd`.
- `Advance` is in window iff `givenAt.slice(0, 10) >= periodStart` AND `givenAt.slice(0, 10) <= periodEnd` (compare by date portion in ISO ordering).
- Both also require `payoutId === undefined` to be considered (so prior payouts can't be double-counted).

### Tests (`src/lib/admin/payout.test.ts`)

Vitest, ~10 tests:

- `unpaidSummary` — empty input → all zeros.
- `unpaidSummary` — mixed roles split correctly into adminTotal / masterTotal.
- `unpaidSummary` — already-paid rows (with payoutId) are excluded.
- `previewPayout` — strict date window inclusivity.
- `previewPayout` — already-paid rows excluded.
- `previewPayout` — net = accrualsTotal - advancesTotal, signed correctly when advances > accruals.
- `closePayout` — after call: payoutsStore has +1 entry; window accruals/advances have payoutId set; outside-window untouched.
- `closePayout` — totalAmount on the new payout equals what previewPayout returned just before.
- `rollbackPayout` — payout removed; linked rows' payoutId cleared; unrelated rows untouched.
- `rollbackPayout` — idempotent (calling twice with the same id is a no-op the second time, no error).

## Components (`src/components/islands/admin/`)

| File | Responsibility |
|---|---|
| `PayrollPanel.tsx` | Tab root. Holds `selectedEmployeeId` state, renders list + card, handles mobile swap. |
| `PayrollEmployeeList.tsx` | Renders the left list. For each employee: name, role, unpaid total. Uses `unpaidSummary`. |
| `PayrollEmployeeCard.tsx` | Right panel orchestrator. Renders PayoutForm + PayoutHistory + AdvanceMiniForm in vertical stack. Holds the "back" button on mobile. |
| `PayoutForm.tsx` | Form for new payout. State: `periodStart, periodEnd, paidAt, note, userTouchedDates`. Computes preview reactively via `previewPayout`. Confirm calls `closePayout`. |
| `PayoutHistory.tsx` | Lists past payouts of the selected employee, expand/collapse, rollback (`🗑`), edit-note (`📝`). |
| `AdvanceMiniForm.tsx` | Mini-form to issue a new advance + last-N advances list with status badges + remove for unpaid only. |

Sub-components (e.g. expand-toggle button, preview details table) live inline
inside their parent file unless they exceed ~40 lines.

## PayoutForm details

### Default values

- `periodStart`: if `today.getDate() <= 15` → `YYYY-MM-01` of current month, else `YYYY-MM-16`.
- `periodEnd`:   if `today.getDate() <= 15` → `YYYY-MM-15`, else last day of current month.
- `paidAt`: today.
- `note`: empty.

The defaults are recomputed whenever the user navigates to a new employee,
**unless** the user has touched any date input in the current session
(`userTouchedDates` flag). Once touched, the form state is preserved per-card
visit.

### Reactive preview block

```
Накоплено за период: <accrualsTotal> ₽
  ├─ админ:  <adminTotal> ₽       ← only shown if employee has admin role
  └─ мойка:  <masterTotal> ₽

Авансы в окне:  −<advancesTotal> ₽
─────────────────────────
К выдаче:       <net> ₽          ← bold, +20% font-size
```

Recalculates on every input change. Uses `previewPayout` from `payout.ts`.

### Confirm button states

- `period.start > period.end` → disabled, hint «период некорректен».
- `accrualsTotal === 0 && advancesTotal === 0` → disabled, hint «нечего выплачивать».
- `net < 0` → disabled, error chip «долг сотрудника: <abs> ₽», tooltip «нельзя выплачивать отрицательную сумму — снизьте удержания или измените период».
- `period.duration > 100 days` → enabled but yellow info chip «слишком длинный период — это типично?».
- otherwise → enabled.

### `Подробнее ▾` expandable section

Shows two tables:

1. Accruals in window: `дата | роль | заметка | сумма`.
2. Advances in window: `дата | заметка | сумма`.

Each accrual row is clickable: emits a `CustomEvent('autolife:focus-accrual', { detail: { date, employeeId, roleKind } })` that switches to Журнал tab and highlights the row. The journal tab needs to listen for this event in D-2.

### Confirm flow

1. Click → `window.confirm(\`Выплатить <name> <amount> ₽ (<period.start>—<period.end>)?\`)`.
2. If confirmed: `closePayout({ employeeId, periodStart, periodEnd, paidAt: paidAtIsoFromInput, note })`.
3. Toast bottom-right: «Выплата сохранена». 3-second auto-dismiss.
4. Form resets to fresh defaults (and `userTouchedDates = false`).
5. Parent `onChange()` bubbles to AdminApp `tick++`, triggering re-render of left list and history.

### Edge case — overlap with existing payout

`previewPayout` already filters by `payoutId === undefined`, so an
overlapping range simply shows fewer eligible rows. Still, if the window
contains *some* dates already used in another payout, prepend an info-row
to the preview: «строки с <overlap.start>—<overlap.end> уже учтены в выплате
от <existing.paidAt> — пропущены». Computed by checking
`accruals.some(a => a.payoutId !== undefined && a.accrualDate in window)`.

## PayoutHistory details

Sorted newest first by `paidAt`. No pagination (deferred to D-2.5).

Each row:

```
12.04.2026 · 1–15 апр · 17 000 ₽ · «<note>»  [▾] [📝] [🗑]
```

Date format: `dd.mm.yyyy` for `paidAt`, period in shorthand (`1–15 апр` / `16–30 апр`). Amount and note from `salary_payouts` row.

`▾ / ▴` toggles inline detail (queries store for accruals/advances with
matching `payoutId`).

`📝` opens an inline `<input>` over the note text. `Enter` or blur saves
via `payoutsStore.upsert({ ...row, note: newNote })`. Sum and dates are
not editable.

`🗑` confirm dialog → `rollbackPayout(payoutId)` → toast «Выплата откачена.
Сумма <X> ₽ снова к выплате.». List reorders without the entry, left
panel `unpaidSummary` updates.

## AdvanceMiniForm details

Form fields:

- `Сумма`: `<input type="number" min="1" step="100">`. Disabled when empty/≤ 0.
- `Заметка`: text up to 80 chars.

Submit → `advancesStore.upsert({ employeeId, amount, note, givenAt: new
Date().toISOString(), payoutId: undefined })` → reset fields → toast «Аванс
выдан: <X> ₽» → parent `onChange()`.

Below the form, list of last 10 advances of the selected employee, sorted by
`givenAt desc`. Status badge per row:

- `payoutId === undefined` → `⏳ не учтён`. Trailing `🗑` button enabled.
- `payoutId !== undefined` → `✓ учтён <dotDate(matchingPayout.paidAt)>`. No
  trailing button.

`🗑` confirm → `advancesStore.remove(id)` → toast.

If there are more than 10 unpaid+paid advances combined, footer link
«Показать все» expands to show full list. No truncation tooling beyond that.

## AdminApp.tsx changes

1. Remove `function Salaries(...)`, `function ShiftsLedger(...)`,
   `function AdvancesLedger(...)`, `function roleLabel(...)`.
2. Replace the conditional render `{tab === 'salaries' && <Salaries ... />}`
   with `{tab === 'salaries' && <PayrollPanel tick={tick} onChange={refresh} />}`.
3. Drop the props that are no longer needed (`shifts`, `adjustments`) from
   the parent `AdminApp` if nothing else still uses them. (Spot check: the
   Dashboard panel uses `shifts` for `shiftSum`. Replace `shiftSum` with
   `unpaidSummary` aggregated across all employees, or simplify Dashboard to
   show last-30-days payouts total. Keep the change minimal.)
4. Remove imports of `salary.ts` exports (`buildSalaryReport`, `periodFor`,
   `recentPeriods`) wherever they appear in AdminApp.tsx.
5. Drop `salary.ts` and `salaries.test.ts` if any (no test file currently —
   verified).
6. Append CSS for the new payroll panel — see CSS section below.

## CSS

~120 lines appended to the existing `Style` template literal in `AdminApp.tsx`,
right after the journal CSS block from D-1. New class prefixes:

- `.aap__payroll` — root grid container.
- `.aap__payroll-list` / `.aap__payroll-list-item` / `.aap__payroll-list-item.is-active`
- `.aap__payroll-card` — right panel wrapper.
- `.aap__payroll-back` — mobile-only «← Назад».
- `.aap__pf*` — payout-form sub-elements (totals, expand toggle, confirm button).
- `.aap__ph*` — payout-history rows.
- `.aap__amf*` — advance mini-form rows.
- `.aap__toast` — bottom-right toast container.

Mobile breakpoint at 768px collapses two-panel grid to single column;
`.aap__payroll-back` becomes visible only when `is-mobile-card-active`.

## Manual smoke (in plan, listed here for spec completeness)

1. Open `/admin` → Зарплаты tab. Empty-state hint visible.
2. Click "Иван" in left list. Right panel shows form with default dates 01—15 of current month, history (empty initially), advance mini-form.
3. Bring up Журнал, fill 2000 ₽ for Иван on today, return to Зарплаты. Левый список показывает у Ивана 2000 ₽.
4. In Иван card, period defaults look right. Preview: «Накоплено: 2000 ₽ (мойка: 2000)», «Авансы: 0», «К выдаче: 2000 ₽». Confirm button enabled.
5. Click Confirm → confirm dialog → toast → history shows 1 entry. Левый список у Ивана теперь 0 ₽.
6. In history, click `▾` → see the linked accrual.
7. Click `🗑` on history → confirm → toast «откачена» → history empty, левый список снова 2000 ₽.
8. Issue advance: 1000 ₽ note «бензин» → submit → form clears, advance appears below with `⏳ не учтён`. Левый список: −1000 ₽ к выдаче (or net negative; verify display).
9. New payout for the same period → preview shows accruals 2000, advances −1000, net 1000 ₽. Confirm → both linked. History: 1 entry; advance now `✓ учтён <dot date>`.
10. Refresh page. State persists. Reset all → all panels empty.

## Non-Goals

- Bonus rows in journal (D-2.5).
- Discrepancies report (D-2.5).
- Fines / unified Удержания tab (D-3).
- Pagination of payout history (deferred until 30+ entries).
- Editing amounts/dates of an existing payout (only rollback + new entry).
- Multi-employee payout in one operation.
- SMS/Telegram notifications.
- Export to Excel/PDF.
- Soft-delete for payouts (rollback already removes them).

## Future Work

- **D-2.5**: bonus rows + discrepancies report.
- **D-3**: fines (`Deduction.type`) + unified Удержания tab; AdvanceMiniForm migrates there.
- **C**: swap `payoutsStore.upsert` to `supabase.from('salary_payouts').insert()`. Swap `closePayout` body to `await supabase.rpc('close_payout', { p_employee_id, p_period_start, p_period_end, p_paid_at, p_note })`. Swap `rollbackPayout` body to a new RPC `rollback_payout(payout_id)` to add in C.

## Open Questions (none blocking D-2)

- Whether Dashboard's "Зарплата админов" card should show YTD payouts total or last-30-days. Pick during implementation, not blocking.
- Whether the toast component should live in a shared `lib/toast.ts` (reused by future features) or be inlined in `PayrollPanel.tsx`. Inline first, extract if a second consumer appears.

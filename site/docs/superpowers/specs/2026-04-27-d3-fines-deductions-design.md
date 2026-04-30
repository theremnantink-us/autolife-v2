# D-3 — Штрафы + унифицированная вкладка «Удержания»

**Date:** 2026-04-27
**Branch:** `redesign-v2`
**Storage:** localStorage (D-3 prototype, swaps to Supabase in project C).
**Depends on:** D-2 (`payoutsStore`, payout flow). D-1 journal stays untouched.
**Blocks:** D-4 (scheduled_payouts editor), D-5 (work_schedule grid).

## Decisions (brainstorm 2026-04-27)

| Q | Outcome |
|---|---|
| Tab placement | **A**: third tab inside the financial frame group → `Статистика | Записи | [Журнал · Зарплаты · Удержания]`. |
| Data migration | **A**: full rename `Advance → Deduction` with required `type: 'advance' \| 'fine'`; localStorage key `advances → deductions` migrated once on first load. |
| Tab UI | **A**: two-panel like Зарплаты — left list with `💸N / ⚠M (sum)`, right card with form + filtered list. |
| Payroll-card stub | **B**: read-only `DeductionsSummary` with 3 latest items + link to "Удержания" tab. AdvanceMiniForm fully removed. |
| Reason field | **A**: free-text, no presets. |

## Schema (`types.ts`)

```ts
export interface Deduction {
  id: string;
  employeeId: EmployeeId;
  type: 'advance' | 'fine';
  amount: number;
  givenAt: string;       // ISO datetime; field name kept for compat
  note?: string;
  reconciled?: boolean;  // legacy from advances; preserved
  payoutId?: string;
}
```

`Advance` interface is removed.

## Store (`store.ts`)

`advancesStore` → `deductionsStore`. Key `advances` → `deductions`. New method `listByType(type)`. Lazy migration helper runs once on first `list()`: reads old `autolife:admin:advances`, stamps each row with `type: 'advance'`, writes to `autolife:admin:deductions`, deletes the old key. Idempotent.

`resetAll` array: `'advances'` → `'deductions'`.

## Helpers (`payout.ts`)

Rename `Advance` → `Deduction` everywhere. Rename return field `advancesTotal` → `deductionsTotal`. Logic unchanged: window filter sums BOTH advance and fine because both subtract from net at payout time.

`mkAdvance` → `mkDeduction` in tests with default `type: 'advance'`. Add 1 test that fines also count toward `deductionsTotal`.

## UI labels

`PayoutForm` preview: «Авансы в окне:» → «**Удержания в окне:**».
`PayoutHistory` expanded section: «Авансы:» → «**Удержания:**» + per-row type badge.

## Tab «Удержания» (5 new components)

| File | Lines | Responsibility |
|---|---|---|
| `DeductionsPanel.tsx` | ~80 | Tab root: `selectedId`, mobile swap, store re-pull on tick. Listens for `autolife:focus-deductions` (sets selectedId). |
| `DeductionsEmployeeList.tsx` | ~70 | Left list: name, role, `💸N / ⚠M (sum)` line. |
| `DeductionsEmployeeCard.tsx` | ~50 | Right card: header + DeductionForm + DeductionsList. |
| `DeductionForm.tsx` | ~100 | Form: type radio (advance/fine), amount, note, submit. Confirm dialog only for fine. |
| `DeductionsList.tsx` | ~110 | Filtered list of all deductions of selected employee. Type filter (все/авансы/штрафы). Per-row: date, amount, type badge, note, status (`⏳`/`✓ <date>`), `🗑` for unpaid. Click `✓ <date>` → dispatch `autolife:focus-payout` event. |

## DeductionsSummary in payroll card

Replaces `AdvanceMiniForm` in `PayrollEmployeeCard.tsx`:

```
─ Удержания ─
Висит к учёту: 8 000 ₽
  💸 1 аванс · 5 000 ₽
  ⚠ 1 штраф · 3 000 ₽

Последние:
  • 14.04 · 5 000 ₽ · аванс · «бензин» ⏳
  • 12.04 · 3 000 ₽ · штраф · «брак» ⏳
  • 02.04 · 3 000 ₽ · аванс · «—» ✓ 12.04

[ Управлять во вкладке "Удержания" → ]
```

`AdvanceMiniForm.tsx` is **deleted** entirely.

## Cross-tab events

| Event | From | Listened by | Effect |
|---|---|---|---|
| `autolife:focus-accrual` | PayoutForm | AdminApp + Journal | Switch to Журнал, set date (D-2 already wired). |
| `autolife:focus-payout` | DeductionsList | AdminApp + PayrollPanel | Switch to Зарплаты, set selectedId. |
| `autolife:focus-deductions` | DeductionsSummary | AdminApp + DeductionsPanel | Switch to Удержания, set selectedId. |

`event.detail`: `{ employeeId?, date?, payoutId? }`. In D-3 only `employeeId` is honored for focus-payout (no payout-row highlighting).

## AdminApp changes

- `Tab` type: add `'deductions'`.
- Tab nav group: 3 buttons instead of 2.
- Conditional render: `{tab === 'deductions' && <DeductionsPanel tick={tick} onChange={refresh} />}`.
- Event listeners: subscribe to `autolife:focus-payout` and `autolife:focus-deductions` to set `tab`. (`autolife:focus-accrual` already wired.)

## CSS

~80 lines `.aap__d*` rules in the existing Style template. Mirrors `.aap__payroll*` patterns.

## Migration plan in C

`deductionsStore.{list, upsert, remove}` bodies → `supabase.from('deductions')...`. The localStorage migration helper becomes dead code, deleted at the same time.

## Non-goals

- Categories/dropdown for fine reasons (free-text only).
- Fine amount limits.
- Dispute flow.
- Bulk operations.
- Analytics dashboards.
- Type-conversion of existing deductions.
- Highlight specific payout row on focus-payout.
- Notifications.

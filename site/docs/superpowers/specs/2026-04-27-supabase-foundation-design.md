# Supabase Foundation — Project A

**Date:** 2026-04-27
**Branch:** `redesign-v2`
**Project ref:** `bqvmhbxwptwuazymqwqk`
**Scope:** Schema + RLS + seeds. No application code changes.

## Goal

Provision the production Supabase database for autolife.ru: schema, row-level
security, and reference data. The app keeps running on its localStorage
prototype after this lands — project A is purely backend groundwork that
unblocks projects B (public booking endpoints), C (admin auth + data-layer
swap), and D (new admin features: per-shift accruals, payouts, fines, schedule
grid).

The schema is shaped so projects D will not need any further migrations: the
new admin features are baked in now.

## Decision Summary

Resolved during brainstorming (2026-04-27):

| Q | Decision |
|---|----------|
| Salary model | **Hybrid (C)**: daily accruals + payout events that close them. |
| Accrual entry | **Manual (A)**: boss types per-employee per-day amount. No commission auto-calc. |
| Payout | **Date range (C)**: boss picks `[start, end]`, system marks accruals/deductions in window paid. |
| Schedule grid | **Pure planner (A)**: visualization only, decoupled from accruals. |
| Fines | **Single `deductions` table (A)** with `type ∈ {advance, fine}`. |
| Editable payout dates | **`scheduled_payouts` table (B)** with planned per-month dates, default 1/16. |
| `employees.is_active` | Add now (`bool default true`). |
| Migration storage | Dual-write: Supabase MCP `apply_migration` AND `supabase/migrations/*.sql` in repo. |

## Schema

### `employees`
Public team list. Drives `/staff`, booking form master picker, gallery
attribution. Reviews stay static in `src/data/employees.ts` (content, not data).

```sql
create table employees (
  id           text primary key,             -- kebab-case slug, stable
  slug         text not null unique,
  name         text not null,
  role         text not null check (role in ('master','admin-shift','admin-master')),
  position     text not null,
  description  text not null,
  photo        text not null,
  is_bookable  boolean not null default true,
  is_active    boolean not null default true,
  years_exp    int,
  specialties  text[] not null default '{}',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
```

### `dashboard_users`
Maps `auth.users` → role + (for limited) which employee they are.

```sql
create table dashboard_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  employee_id  text references employees(id),
  role         text not null check (role in ('owner','limited')),
  created_at   timestamptz not null default now()
);
```

### `appointments`
Public booking sink. Anon can INSERT, never SELECT.

```sql
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  customer_phone  text not null,
  car_brand       text not null,
  car_model       text not null,
  service_name    text not null,
  service_price   int  not null,
  master_id       text references employees(id),
  slot_start      timestamptz not null,
  status          text not null default 'new'
                  check (status in ('new','confirmed','completed','cancelled','no-show')),
  additional_info text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index appointments_slot_start_idx on appointments(slot_start);
create index appointments_master_idx     on appointments(master_id, slot_start);
```

### `working_hours`
Per-employee weekly availability. Drives `v_busy_dates`.

```sql
create table working_hours (
  employee_id   text not null references employees(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6), -- 0 = Sun
  start_minute  smallint not null check (start_minute between 0 and 1440),
  end_minute    smallint not null check (end_minute  between 0 and 1440),
  primary key (employee_id, weekday),
  check (end_minute > start_minute)
);
```

### `salary_accruals`
Daily ledger of "what each employee earned today". Manual entry by owner.
Bonuses are just additional rows with a `note`. `role_kind` lets multi-role
employees (Иван — `admin-master`; Сергей — also doubles as washer occasionally)
be split per row, so payout summaries can show "за смену админом: X ₽ / за
смену мойщиком: Y ₽" separately. Single-role employees use the default
(`master`) and the UI hides the role selector. When `payout_id` is non-null,
the row is locked into a paid-out payout.

```sql
create table salary_accruals (
  id            uuid primary key default gen_random_uuid(),
  employee_id   text not null references employees(id),
  accrual_date  date not null,
  role_kind     text not null check (role_kind in ('admin','master'))
                default 'master',
  amount        int  not null check (amount > 0),
  note          text,
  payout_id     uuid references salary_payouts(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index salary_accruals_emp_date_idx on salary_accruals(employee_id, accrual_date);
create index salary_accruals_unpaid_idx   on salary_accruals(employee_id) where payout_id is null;
```

### `salary_payouts`
A payout event closes accruals and deductions in a date window.

```sql
create table salary_payouts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   text not null references employees(id),
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  paid_at       timestamptz not null default now(),
  total_amount  int  not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index salary_payouts_emp_idx on salary_payouts(employee_id, paid_at desc);
```

`salary_accruals.payout_id` and `deductions.payout_id` are populated atomically
inside an RPC `close_payout(employee_id, period_start, period_end, paid_at, note)`
that:
1. Computes `net = sum(unpaid accruals in window) − sum(unpaid deductions in window)`.
2. Inserts `salary_payouts` with `total_amount = net`.
3. Updates matching unpaid `salary_accruals` and `deductions` rows to point at
   the new payout.
4. Returns the inserted payout row.

The RPC is `security definer`, owner-only via internal role check.

### `deductions`
Unified ledger for advances and fines. Same shape, `type` distinguishes them.

```sql
create table deductions (
  id            uuid primary key default gen_random_uuid(),
  employee_id   text not null references employees(id),
  type          text not null check (type in ('advance','fine')),
  amount        int  not null check (amount > 0),
  applied_at    timestamptz not null default now(),
  reason        text,
  payout_id     uuid references salary_payouts(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index deductions_emp_idx     on deductions(employee_id, applied_at desc);
create index deductions_unpaid_idx  on deductions(employee_id, type) where payout_id is null;
```

### `scheduled_payouts`
Planned payout dates. Default 1st / 16th, editable per month for force-majeure.

```sql
create table scheduled_payouts (
  year          smallint not null,
  month         smallint not null check (month between 1 and 12),
  half          char(2)  not null check (half in ('H1','H2')),
  planned_date  date not null,
  primary key (year, month, half)
);
```

Pre-seeded for 12 months ahead from the migration date with H1 = `YYYY-MM-01`,
H2 = `YYYY-MM-16`.

### `work_schedule`
Pure planner grid: who works which day, in which role. No effect on accruals.

```sql
create table work_schedule (
  employee_id  text not null references employees(id) on delete cascade,
  work_date    date not null,
  role         text not null check (role in ('admin','master','off')),
  note         text,
  primary key (employee_id, work_date)
);
```

### View `v_busy_dates`
Anon-readable. Aggregates booked slots per master per day.

```sql
create view v_busy_dates as
select master_id as employee_id,
       (slot_start at time zone 'Europe/Moscow')::date as busy_date,
       count(*) as taken_slots
from appointments
where status in ('new','confirmed','completed')
group by 1, 2;
```

Slot-capacity logic (whether `taken_slots` means "fully booked") is project B's
problem; here we just expose the count without leaking PII.

## RLS

Three identities: `anon`, authenticated `owner`, authenticated `limited`.

### Helper functions

```sql
create or replace function current_dashboard_role() returns text
language sql security definer stable as $$
  select role from dashboard_users where user_id = auth.uid();
$$;

create or replace function current_employee_id() returns text
language sql security definer stable as $$
  select employee_id from dashboard_users where user_id = auth.uid();
$$;
```

`security definer` so the helpers can read `dashboard_users` from inside RLS
policies without recursion.

### Per-table policies

| Table                | anon                          | owner | limited                                                                |
| -------------------- | ----------------------------- | ----- | ---------------------------------------------------------------------- |
| `employees`          | SELECT (where `is_active`)    | ALL   | SELECT                                                                 |
| `appointments`       | INSERT only                   | ALL   | SELECT all; UPDATE `status`/`completed_at` where `master_id = current_employee_id()` |
| `working_hours`      | SELECT                        | ALL   | SELECT                                                                 |
| `v_busy_dates`       | SELECT                        | SELECT| SELECT                                                                 |
| `salary_accruals`    | —                             | ALL   | SELECT where `employee_id = current_employee_id()`                     |
| `salary_payouts`     | —                             | ALL   | SELECT where `employee_id = current_employee_id()`                     |
| `deductions`         | —                             | ALL   | SELECT where `employee_id = current_employee_id()`                     |
| `scheduled_payouts`  | —                             | ALL   | SELECT                                                                 |
| `work_schedule`      | —                             | ALL   | SELECT                                                                 |
| `dashboard_users`    | —                             | ALL   | SELECT where `user_id = auth.uid()`                                    |

`limited`'s appointment UPDATE is column-restricted via a `before update`
trigger that rejects changes to any column other than `status`, `completed_at`
when `current_dashboard_role() = 'limited'`.

## Seeds

1. **`employees`** — 6 rows from `src/data/employees.ts` mapped to columns:
   `sergey, ivan, bill, alexander, vladimir, roman` with `sort_order` 1..6.
   `reviews` field is not migrated.
2. **`dashboard_users`** — empty. Populated in project C once Артур/Ирина/Билл
   email addresses are provided and they sign in via magic-link.
3. **`working_hours`** — for every `is_bookable = true` employee, weekdays
   1..6 (Mon–Sat) at `09:00 → 20:00` (`start_minute=540`, `end_minute=1200`).
   Sunday omitted = unavailable.
4. **`scheduled_payouts`** — 12 months forward from today; for each month
   insert (H1, `YYYY-MM-01`) and (H2, `YYYY-MM-16`).
5. **`work_schedule`** — empty.
6. **`appointments`** — empty (production table, no demo data).

## Migration plan

Each step run via Supabase MCP `apply_migration`, AND mirrored to
`supabase/migrations/<timestamp>_<name>.sql` in the repo for git history.

Tables are created in dependency order: `employees` and `auth.users`-dependent
`dashboard_users` first; `salary_payouts` before `salary_accruals` /
`deductions` (which FK to it); everything else has no inter-table FK
dependencies beyond `employees`. No circular FKs.

1. `001_schema.sql` — all `create table` statements + indexes in dependency
   order: `employees`, `dashboard_users`, `appointments`, `working_hours`,
   `salary_payouts`, `salary_accruals`, `deductions`, `scheduled_payouts`,
   `work_schedule`.
2. `002_view.sql` — `v_busy_dates`.
3. `003_helpers_and_rls.sql` — `current_dashboard_role`,
   `current_employee_id`, enable RLS on all tables, create policies, create
   `before update` trigger on `appointments` for limited column-restriction.
4. `004_rpc_close_payout.sql` — `close_payout(...)` function. Body begins with
   `if current_dashboard_role() is distinct from 'owner' then raise exception
   'forbidden'; end if;` so the `security definer` grant cannot be abused by
   `limited` or `anon`.
5. `005_seed_employees.sql` — INSERT 6 employees.
6. `006_seed_working_hours.sql` — INSERT working_hours.
7. `007_seed_scheduled_payouts.sql` — generate 12 months × 2 halves via
   `generate_series`.

## Application code (this project)

Only one file:

```
site/src/lib/supabase.ts
```

Exports `supabase` — `createClient(url, anonKey)` from `@supabase/supabase-js`,
reading `import.meta.env.PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
Not yet imported anywhere; created so projects B/C/D have a single import.

Add `@supabase/supabase-js` to `dependencies` in `site/package.json`.

Add to `.env.example`:
```
PUBLIC_SUPABASE_URL=https://bqvmhbxwptwuazymqwqk.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The actual `.env.local` is created by the user (anon key fetched from Supabase
dashboard or shared via project secret).

## Non-Goals

- No SSR adapter, no Astro endpoints (project B).
- No Auth UI / middleware (project C).
- No changes to `src/lib/admin/store.ts`, `AdminApp.tsx`, `BookingForm.tsx`,
  `BookingCalendar.tsx`. The localStorage prototype keeps working.
- No removal of PHP endpoints (`api.php`, `busy_dates.php`, `csrf.php`) —
  those die in project B.
- No commission rules table / auto-calc — accruals are manual entry.

## Future Work (tracked, not in A)

1. **Project B:** SSR adapter (`@astrojs/node`), `/api/booking`,
   `/api/availability`, switch `BookingForm`/`BookingCalendar` off PHP.
2. **Project C:** `dashboard_users` population for Артур/Ирина/Билл,
   Supabase Auth magic-link, `/admin/login`, middleware, `store.ts` swap to
   `supabase.from(...)`. UI of `AdminApp.tsx` does not change.
3. **Project D (sub-features, in order):**
   - Daily accruals journal UI (table emp×date with inline edit).
   - Payout flow: pick range, see net **with role-split breakdown**
     (`sum(amount) where role_kind='admin'` vs `where role_kind='master'`) for
     multi-role employees, confirm → call `close_payout` RPC.
   - Fines UI: shares the deductions form with advances, toggle by `type`.
   - `scheduled_payouts` editor under "Settings → Даты выплат".
   - `work_schedule` grid editor (rows = employees, cols = days of month, role
     dropdown per cell).

## Open Questions (none blocking A)

- Email addresses for Артур/Ирина/Билл (needed at start of project C).
- Slot-capacity rule for `v_busy_dates` (project B).
- Whether `working_hours` should be per-employee per-date (override) instead
  of weekday-only — defer until first force-majeure happens.

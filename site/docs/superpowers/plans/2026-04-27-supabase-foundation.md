# Supabase Foundation — Project A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the production Supabase database for autolife.ru — schema, RLS, and seeds — without touching any application code paths beyond a single `supabase.ts` client export.

**Architecture:** Seven SQL migrations applied via Supabase MCP `apply_migration` and dual-written to `supabase/migrations/` for git history. Tables created in dependency order; RLS uses two `security definer` helpers (`current_dashboard_role`, `current_employee_id`); a `close_payout(...)` RPC atomically closes a payout window and links accruals/deductions to it.

**Tech Stack:** PostgreSQL (Supabase), Supabase MCP server (`apply_migration`, `execute_sql`, `list_tables`), `@supabase/supabase-js`, Astro 5 + Vite env vars.

**Spec:** `site/docs/superpowers/specs/2026-04-27-supabase-foundation-design.md`

**Working directory:** `/Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site/` — all paths below are relative to this unless they start with `supabase/` (which lives at the worktree root, one level above `site/`).

---

## File Structure

| Path (from worktree root)                                       | Action  | Responsibility                                                       |
|-----------------------------------------------------------------|---------|----------------------------------------------------------------------|
| `supabase/migrations/20260427000001_schema.sql`                 | Create  | All `create table` + indexes in dependency order.                    |
| `supabase/migrations/20260427000002_view.sql`                   | Create  | `v_busy_dates` view.                                                 |
| `supabase/migrations/20260427000003_helpers_and_rls.sql`        | Create  | `current_dashboard_role`, `current_employee_id`, RLS policies, `appointments` column-restriction trigger. |
| `supabase/migrations/20260427000004_rpc_close_payout.sql`       | Create  | `close_payout(...)` function (owner-only).                           |
| `supabase/migrations/20260427000005_seed_employees.sql`         | Create  | Insert 6 employees from `site/src/data/employees.ts`.                |
| `supabase/migrations/20260427000006_seed_working_hours.sql`     | Create  | Mon–Sat 09:00–20:00 for `is_bookable=true` employees.                |
| `supabase/migrations/20260427000007_seed_scheduled_payouts.sql` | Create  | 12 months × (H1=01, H2=16) via `generate_series`.                    |
| `site/src/lib/supabase.ts`                                      | Create  | `export const supabase = createClient(url, anonKey)`.                |
| `site/.env.example`                                             | Create  | Document `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`.          |
| `site/package.json`                                             | Modify  | Add `@supabase/supabase-js` dependency.                              |
| `site/.gitignore`                                               | Verify  | Ensure `.env.local` is ignored.                                      |

---

## Task 0: Pre-flight — confirm DB state and load tools

**Files:** none

- [ ] **Step 1: Load Supabase MCP tools**

Use `ToolSearch` with query `select:mcp__supabase__list_tables,mcp__supabase__apply_migration,mcp__supabase__execute_sql,mcp__supabase__list_migrations` to load schemas. If the tools return "needs auth", ask the user to run `/mcp` and re-authenticate. Do NOT proceed without these four tools loaded.

- [ ] **Step 2: List existing tables**

Call `mcp__supabase__list_tables` with `schemas=["public"]`.

Expected: empty array, OR a list. If a list is returned, **stop and ask the user** which tables to keep before applying migrations. Do NOT drop anything.

- [ ] **Step 3: List existing migrations**

Call `mcp__supabase__list_migrations`.

Expected: empty. If non-empty, paste the list to the user and confirm before continuing.

- [ ] **Step 4: Create migrations directory**

```bash
mkdir -p /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/supabase/migrations
```

---

## Task 1: Migration 001 — schema

**Files:**
- Create: `supabase/migrations/20260427000001_schema.sql`

- [ ] **Step 1: Write the migration SQL**

Write this exact content to `supabase/migrations/20260427000001_schema.sql`:

```sql
-- Project A — schema. Tables in FK-dependency order.

create table employees (
  id           text primary key,
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

create table dashboard_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  employee_id  text references employees(id),
  role         text not null check (role in ('owner','limited')),
  created_at   timestamptz not null default now()
);

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

create table working_hours (
  employee_id   text not null references employees(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  start_minute  smallint not null check (start_minute between 0 and 1440),
  end_minute    smallint not null check (end_minute  between 0 and 1440),
  primary key (employee_id, weekday),
  check (end_minute > start_minute)
);

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

create table scheduled_payouts (
  year          smallint not null,
  month         smallint not null check (month between 1 and 12),
  half          char(2)  not null check (half in ('H1','H2')),
  planned_date  date not null,
  primary key (year, month, half)
);

create table work_schedule (
  employee_id  text not null references employees(id) on delete cascade,
  work_date    date not null,
  role         text not null check (role in ('admin','master','off')),
  note         text,
  primary key (employee_id, work_date)
);
```

- [ ] **Step 2: Apply via Supabase MCP**

Call `mcp__supabase__apply_migration` with `name="schema"` and `query=` the SQL above.

Expected: success.

- [ ] **Step 3: Verify tables exist**

Call `mcp__supabase__list_tables` with `schemas=["public"]`.

Expected: 9 tables — `employees, dashboard_users, appointments, working_hours, salary_payouts, salary_accruals, deductions, scheduled_payouts, work_schedule`.

- [ ] **Step 4: Verify the role_kind column exists**

Call `mcp__supabase__execute_sql` with:
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'salary_accruals' and column_name = 'role_kind';
```
Expected: one row, `text`, default `'master'::text`.

- [ ] **Step 5: Commit**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git add supabase/migrations/20260427000001_schema.sql
git commit -m "feat(db): project A — migration 001 schema"
```

---

## Task 2: Migration 002 — `v_busy_dates` view

**Files:**
- Create: `supabase/migrations/20260427000002_view.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
create view v_busy_dates as
select master_id as employee_id,
       (slot_start at time zone 'Europe/Moscow')::date as busy_date,
       count(*) as taken_slots
from appointments
where status in ('new','confirmed','completed')
group by 1, 2;
```

- [ ] **Step 2: Apply via MCP**

Call `mcp__supabase__apply_migration` with `name="view_busy_dates"` and the SQL above.

- [ ] **Step 3: Verify view shape**

Call `execute_sql`:
```sql
select * from v_busy_dates;
```
Expected: empty result, no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427000002_view.sql
git commit -m "feat(db): project A — migration 002 v_busy_dates view"
```

---

## Task 3: Migration 003 — helpers, RLS, appointments column-restriction trigger

**Files:**
- Create: `supabase/migrations/20260427000003_helpers_and_rls.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Helpers ----------------------------------------------------------------

create or replace function current_dashboard_role() returns text
language sql security definer stable set search_path = public as $$
  select role from dashboard_users where user_id = auth.uid();
$$;

create or replace function current_employee_id() returns text
language sql security definer stable set search_path = public as $$
  select employee_id from dashboard_users where user_id = auth.uid();
$$;

-- Enable RLS -------------------------------------------------------------

alter table employees          enable row level security;
alter table dashboard_users    enable row level security;
alter table appointments       enable row level security;
alter table working_hours      enable row level security;
alter table salary_payouts     enable row level security;
alter table salary_accruals    enable row level security;
alter table deductions         enable row level security;
alter table scheduled_payouts  enable row level security;
alter table work_schedule      enable row level security;

-- Policies ---------------------------------------------------------------

-- employees
create policy employees_anon_select on employees for select
  to anon using (is_active);
create policy employees_owner_all on employees for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy employees_limited_select on employees for select
  to authenticated using (current_dashboard_role() in ('owner','limited'));

-- appointments
create policy appointments_anon_insert on appointments for insert
  to anon with check (true);
create policy appointments_owner_all on appointments for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy appointments_limited_select on appointments for select
  to authenticated using (current_dashboard_role() in ('owner','limited'));
create policy appointments_limited_update on appointments for update
  to authenticated
  using (current_dashboard_role() = 'limited' and master_id = current_employee_id())
  with check (current_dashboard_role() = 'limited' and master_id = current_employee_id());

-- Column-restrict limited's UPDATE on appointments
create or replace function appointments_limited_column_guard() returns trigger
language plpgsql as $$
begin
  if current_dashboard_role() = 'limited' then
    if new.customer_name   is distinct from old.customer_name   then raise exception 'forbidden column'; end if;
    if new.customer_phone  is distinct from old.customer_phone  then raise exception 'forbidden column'; end if;
    if new.car_brand       is distinct from old.car_brand       then raise exception 'forbidden column'; end if;
    if new.car_model       is distinct from old.car_model       then raise exception 'forbidden column'; end if;
    if new.service_name    is distinct from old.service_name    then raise exception 'forbidden column'; end if;
    if new.service_price   is distinct from old.service_price   then raise exception 'forbidden column'; end if;
    if new.master_id       is distinct from old.master_id       then raise exception 'forbidden column'; end if;
    if new.slot_start      is distinct from old.slot_start      then raise exception 'forbidden column'; end if;
    if new.additional_info is distinct from old.additional_info then raise exception 'forbidden column'; end if;
    if new.created_at      is distinct from old.created_at      then raise exception 'forbidden column'; end if;
  end if;
  return new;
end;
$$;
create trigger appointments_limited_column_guard
  before update on appointments
  for each row execute function appointments_limited_column_guard();

-- working_hours
create policy working_hours_anon_select on working_hours for select to anon using (true);
create policy working_hours_owner_all on working_hours for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy working_hours_limited_select on working_hours for select
  to authenticated using (current_dashboard_role() in ('owner','limited'));

-- salary_accruals
create policy salary_accruals_owner_all on salary_accruals for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy salary_accruals_limited_select on salary_accruals for select
  to authenticated using (current_dashboard_role() = 'limited' and employee_id = current_employee_id());

-- salary_payouts
create policy salary_payouts_owner_all on salary_payouts for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy salary_payouts_limited_select on salary_payouts for select
  to authenticated using (current_dashboard_role() = 'limited' and employee_id = current_employee_id());

-- deductions
create policy deductions_owner_all on deductions for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy deductions_limited_select on deductions for select
  to authenticated using (current_dashboard_role() = 'limited' and employee_id = current_employee_id());

-- scheduled_payouts
create policy scheduled_payouts_owner_all on scheduled_payouts for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy scheduled_payouts_limited_select on scheduled_payouts for select
  to authenticated using (current_dashboard_role() in ('owner','limited'));

-- work_schedule
create policy work_schedule_owner_all on work_schedule for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy work_schedule_limited_select on work_schedule for select
  to authenticated using (current_dashboard_role() in ('owner','limited'));

-- dashboard_users
create policy dashboard_users_owner_all on dashboard_users for all
  to authenticated using (current_dashboard_role() = 'owner')
  with check (current_dashboard_role() = 'owner');
create policy dashboard_users_self_select on dashboard_users for select
  to authenticated using (user_id = auth.uid());

-- v_busy_dates view inherits security from underlying appointments policies;
-- but we need explicit GRANT so anon can read it.
grant select on v_busy_dates to anon, authenticated;
```

> Note: views in Postgres respect the `security_invoker` setting. To ensure the view is queryable by `anon` even though `appointments` only allows anon INSERT, mark the view as a security barrier with the invoker disabled — Supabase Postgres ≥15 supports `with (security_invoker = off)` so the view runs with the *creator's* permissions. Add this at the end:
```sql
alter view v_busy_dates set (security_invoker = off);
```

(Append the `alter view` line at the bottom of the migration file.)

- [ ] **Step 2: Apply via MCP**

Call `apply_migration` with `name="helpers_and_rls"` and the SQL above (including the `alter view` tail).

- [ ] **Step 3: Verify RLS is on everywhere**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```
Expected: 9 rows, all `rowsecurity = true`.

- [ ] **Step 4: Verify helper function exists**

```sql
select proname from pg_proc
where proname in ('current_dashboard_role','current_employee_id');
```
Expected: 2 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260427000003_helpers_and_rls.sql
git commit -m "feat(db): project A — migration 003 RLS + helpers + appointments guard"
```

---

## Task 4: Migration 004 — `close_payout` RPC

**Files:**
- Create: `supabase/migrations/20260427000004_rpc_close_payout.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
create or replace function close_payout(
  p_employee_id  text,
  p_period_start date,
  p_period_end   date,
  p_paid_at      timestamptz default now(),
  p_note         text default null
) returns salary_payouts
language plpgsql security definer set search_path = public as $$
declare
  v_accrual_total int;
  v_deduction_total int;
  v_total int;
  v_payout salary_payouts;
begin
  if current_dashboard_role() is distinct from 'owner' then
    raise exception 'forbidden';
  end if;
  if p_period_end < p_period_start then
    raise exception 'period_end before period_start';
  end if;

  select coalesce(sum(amount), 0) into v_accrual_total
  from salary_accruals
  where employee_id = p_employee_id
    and payout_id is null
    and accrual_date between p_period_start and p_period_end;

  select coalesce(sum(amount), 0) into v_deduction_total
  from deductions
  where employee_id = p_employee_id
    and payout_id is null
    and applied_at::date between p_period_start and p_period_end;

  v_total := v_accrual_total - v_deduction_total;

  insert into salary_payouts(employee_id, period_start, period_end, paid_at, total_amount, note)
  values (p_employee_id, p_period_start, p_period_end, p_paid_at, v_total, p_note)
  returning * into v_payout;

  update salary_accruals set payout_id = v_payout.id
   where employee_id = p_employee_id
     and payout_id is null
     and accrual_date between p_period_start and p_period_end;

  update deductions set payout_id = v_payout.id
   where employee_id = p_employee_id
     and payout_id is null
     and applied_at::date between p_period_start and p_period_end;

  return v_payout;
end;
$$;

revoke all on function close_payout(text,date,date,timestamptz,text) from public, anon;
grant execute on function close_payout(text,date,date,timestamptz,text) to authenticated;
```

- [ ] **Step 2: Apply via MCP**

Call `apply_migration` with `name="rpc_close_payout"` and the SQL above.

- [ ] **Step 3: Verify function**

```sql
select proname, pronargs from pg_proc where proname = 'close_payout';
```
Expected: 1 row, `pronargs = 5`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427000004_rpc_close_payout.sql
git commit -m "feat(db): project A — migration 004 close_payout RPC"
```

---

## Task 5: Migration 005 — seed `employees`

**Files:**
- Create: `supabase/migrations/20260427000005_seed_employees.sql`

- [ ] **Step 1: Read source data**

Open `site/src/data/employees.ts` and confirm 6 entries exist with ids: `sergey, ivan, bill, alexander, vladimir, roman`. If counts differ, **stop and ask the user**.

- [ ] **Step 2: Write the migration SQL**

Insert 6 rows mapping `Employee` → row. Use the exact values from `employees.ts` for `name`, `position`, `description`, `photo`, `is_bookable`, `years_exp`, `specialties`. `slug = id`. `sort_order` = 1..6 in the array order.

```sql
insert into employees (id, slug, name, role, position, description, photo, is_bookable, years_exp, specialties, sort_order) values
('sergey',    'sergey',    'Сергей',     'admin-shift',  'Администратор смены',
 'Встречает клиентов, согласует объём работ и передаёт автомобиль мастеру. Координирует загрузку постов и контроль качества.',
 '/IMG/staff/sergey.svg',    false, 5, array['Приёмка','Контроль качества','Координация'], 1),

('ivan',      'ivan',      'Иван',       'admin-master', 'Мастер · администратор',
 'Совмещает роль мастера по уходу и администратора смены. Отвечает за сложные кейсы детейлинга и обучение младших мастеров.',
 '/IMG/staff/ivan.svg',      true,  8, array['Полировка','Керамика','Химчистка','Приёмка'], 2),

('bill',      'bill',      'Билл',       'master',       'Мастер по уходу',
 'Отвечает за сайт, маркетинг и онлайн-запись. На постах — мастер по уходу за кузовом и салоном. Любит сложные пятна и старую кожу.',
 '/IMG/staff/bill.svg',      true,  4, array['Химчистка кожи','Удаление пятен','Антидождь'], 3),

('alexander', 'alexander', 'Александр',  'master',       'Мастер по уходу',
 'Специализируется на детейлинг-мойке премиум-класса и предпродажной подготовке. Аккуратный с любым кузовом и оптикой.',
 '/IMG/staff/alexander.svg', true,  6, array['Детейлинг-мойка','Полировка фар','Предпродажная'], 4),

('vladimir',  'vladimir',  'Владимир',   'master',       'Мастер по уходу',
 'Профильный по шиномонтажу и хранению шин. Знает геометрию дисков и не дерёт борта на низкопрофильной резине.',
 '/IMG/staff/vladimir.svg',  true,  9, array['Шиномонтаж','Балансировка','Хранение шин'], 5),

('roman',     'roman',     'Роман',      'master',       'Мастер по уходу',
 'Сильная сторона — химчистка салона и удаление запахов. Работает с тканевой обивкой и потолком без разводов.',
 '/IMG/staff/roman.svg',     true,  5, array['Химчистка салона','Удаление запахов','Озонация'], 6);
```

- [ ] **Step 2: Apply via MCP**

Call `apply_migration` with `name="seed_employees"`.

- [ ] **Step 3: Verify**

```sql
select id, role, sort_order from employees order by sort_order;
```
Expected: 6 rows in order `sergey, ivan, bill, alexander, vladimir, roman`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427000005_seed_employees.sql
git commit -m "feat(db): project A — migration 005 seed employees"
```

---

## Task 6: Migration 006 — seed `working_hours`

**Files:**
- Create: `supabase/migrations/20260427000006_seed_working_hours.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
insert into working_hours (employee_id, weekday, start_minute, end_minute)
select e.id, w.weekday, 540, 1200
from employees e
cross join generate_series(1, 6) as w(weekday)
where e.is_bookable = true;
```

- [ ] **Step 2: Apply via MCP**

Call `apply_migration` with `name="seed_working_hours"`.

- [ ] **Step 3: Verify**

```sql
select count(*) from working_hours;
```
Expected: 5 bookable employees × 6 weekdays = **30 rows**.

```sql
select distinct start_minute, end_minute from working_hours;
```
Expected: one row, `(540, 1200)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427000006_seed_working_hours.sql
git commit -m "feat(db): project A — migration 006 seed working_hours"
```

---

## Task 7: Migration 007 — seed `scheduled_payouts`

**Files:**
- Create: `supabase/migrations/20260427000007_seed_scheduled_payouts.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
with months as (
  select
    extract(year  from m)::smallint as y,
    extract(month from m)::smallint as mo
  from generate_series(date_trunc('month', current_date),
                       date_trunc('month', current_date) + interval '11 months',
                       interval '1 month') as g(m)
)
insert into scheduled_payouts (year, month, half, planned_date)
select y, mo, 'H1', make_date(y, mo, 1)  from months
union all
select y, mo, 'H2', make_date(y, mo, 16) from months;
```

- [ ] **Step 2: Apply via MCP**

Call `apply_migration` with `name="seed_scheduled_payouts"`.

- [ ] **Step 3: Verify**

```sql
select count(*) from scheduled_payouts;
```
Expected: **24 rows** (12 months × 2 halves).

```sql
select min(planned_date), max(planned_date) from scheduled_payouts;
```
Expected: min = 1st of current month; max = 16th of (current month + 11).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427000007_seed_scheduled_payouts.sql
git commit -m "feat(db): project A — migration 007 seed scheduled_payouts"
```

---

## Task 8: Install `@supabase/supabase-js`

**Files:**
- Modify: `site/package.json`
- Modify: `site/package-lock.json`

- [ ] **Step 1: Install**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npm install @supabase/supabase-js
```

- [ ] **Step 2: Verify**

```bash
node -e "console.log(require('./node_modules/@supabase/supabase-js/package.json').version)"
```
Expected: a version string (≥ 2.x).

- [ ] **Step 3: Commit**

```bash
git add site/package.json site/package-lock.json
git commit -m "chore(deps): add @supabase/supabase-js"
```

---

## Task 9: Create `src/lib/supabase.ts`

**Files:**
- Create: `site/src/lib/supabase.ts`

- [ ] **Step 1: Write the client**

```ts
/**
 * Supabase client — public anon key only. Server-side code that needs the
 * service role must build its own client from `SUPABASE_SERVICE_ROLE_KEY`
 * and never import this module.
 */
import { createClient } from '@supabase/supabase-js';

const url     = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set in .env.local',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
npx astro check
```
Expected: no new errors. (Existing project errors that pre-date this task can be left alone — flag them in the final summary if any appear.)

> If `astro check` fails because env vars are missing in the **build context**, that is expected for now — the import is dead code (no caller). Move on; project C wires it up.

- [ ] **Step 3: Commit**

```bash
git add site/src/lib/supabase.ts
git commit -m "feat(supabase): add anon client at src/lib/supabase.ts"
```

---

## Task 10: `.env.example` and `.gitignore` check

**Files:**
- Create: `site/.env.example`
- Verify: `site/.gitignore`

- [ ] **Step 1: Write `.env.example`**

```
# Supabase — public anon key (safe to ship; RLS is the gate).
PUBLIC_SUPABASE_URL=https://bqvmhbxwptwuazymqwqk.supabase.co
PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 2: Verify `.env.local` is gitignored**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2/site
grep -E '(^|/)\.env(\.local|\*)?$' .gitignore || echo "MISSING"
```

If `MISSING`, append `.env.local` to `site/.gitignore`.

- [ ] **Step 3: Commit**

```bash
git add site/.env.example site/.gitignore
git commit -m "chore(env): document Supabase env vars + ignore .env.local"
```

---

## Task 11: Final verification

**Files:** none

- [ ] **Step 1: Re-list public tables**

Call `list_tables` with `schemas=["public"]`. Expected: 9 tables, all RLS-enabled.

- [ ] **Step 2: Sanity-query seeds**

```sql
select
  (select count(*) from employees) as employees_count,
  (select count(*) from working_hours) as wh_count,
  (select count(*) from scheduled_payouts) as sp_count;
```
Expected: `(6, 30, 24)`.

- [ ] **Step 3: Verify anon CAN read employees + working_hours + v_busy_dates and CANNOT read appointments**

Use `execute_sql` (which runs as the project owner — to actually test anon, run via the anon role):

```sql
set local role anon;
select count(*) from employees;       -- expect 6
select count(*) from working_hours;   -- expect 30
select count(*) from v_busy_dates;    -- expect 0, no error
select count(*) from appointments;    -- expect ERROR or 0 with no rows visible
reset role;
```

If `appointments` returns `0` instead of erroring, that is fine — RLS hides rows rather than blocking the table; what matters is that no PII leaks.

- [ ] **Step 4: Verify anon CANNOT read salary tables**

```sql
set local role anon;
select count(*) from salary_accruals;     -- expect 0 (RLS hides everything)
select count(*) from salary_payouts;
select count(*) from deductions;
reset role;
```

Expected: each returns `0`. If any returns rows, RLS is broken — fix before moving on.

- [ ] **Step 5: Push branch**

```bash
cd /Users/bill/Downloads/autolife.ru/.worktrees/redesign-v2
git push -u origin redesign-v2
```

(Skip this step if the user prefers to push manually.)

- [ ] **Step 6: Summary message to user**

Tell the user:
- Project A applied. 7 migrations live, 9 tables + 1 view + 1 RPC.
- `supabase.ts` client added but not yet imported anywhere — projects B/C/D import it.
- Next: project D (per-shift accruals UI). Ask if they want to start D now or pause.
- Reminder: they need to put their actual `PUBLIC_SUPABASE_ANON_KEY` in `site/.env.local` before any client code uses `supabase.ts`.

---

## Self-Review notes

**Spec coverage:** every table, view, RPC, RLS policy, and seed in the spec maps to a task above. The `is_active` addition (spec §1) is in Task 1. `role_kind` split is in Task 1 schema. Migration filenames mirror the spec's migration plan (renumbered to timestamp prefix per Supabase convention).

**Placeholders:** none. All SQL is fully specified.

**Type consistency:** `salary_accruals.role_kind` allowed values (`'admin','master'`) match the future-D summary requirement (split admin vs washer). `current_dashboard_role()` referenced in Task 4 RPC matches the helper created in Task 3. Migration names are all lowercase snake-case.

**Open risks:**
- The `set local role anon` trick in Task 11 may not behave identically to a real anon JWT request, but it's the closest thing Supabase MCP `execute_sql` exposes. If verification feels weak, project B will hit `v_busy_dates` and `appointments` insert from the actual frontend and surface any RLS gap.
- Migration 003's `alter view v_busy_dates set (security_invoker = off)` is the supported way to let `anon` read aggregate data over RLS-protected `appointments`. If the Postgres version on this Supabase project is older and does not support `security_invoker`, fall back to wrapping the view body in a `security definer` function and selecting from that function instead. Verify Postgres version with `select version();` if Task 3 step 2 errors.

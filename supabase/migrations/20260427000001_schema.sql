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

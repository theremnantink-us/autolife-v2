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

-- v_busy_dates view: ensure anon can read it despite RLS on appointments.
alter view v_busy_dates set (security_invoker = off);
grant select on v_busy_dates to anon, authenticated;

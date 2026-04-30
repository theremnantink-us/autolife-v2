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

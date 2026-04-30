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

create view v_busy_dates as
select master_id as employee_id,
       (slot_start at time zone 'Europe/Moscow')::date as busy_date,
       count(*) as taken_slots
from appointments
where status in ('new','confirmed','completed')
group by 1, 2;

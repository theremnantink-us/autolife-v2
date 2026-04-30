insert into working_hours (employee_id, weekday, start_minute, end_minute)
select e.id, w.weekday, 540, 1200
from employees e
cross join generate_series(1, 6) as w(weekday)
where e.is_bookable = true;

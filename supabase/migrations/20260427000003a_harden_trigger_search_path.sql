-- Address advisor warning: lock the trigger's search_path so a malicious
-- schema on the session search_path cannot shadow `current_dashboard_role`.
alter function appointments_limited_column_guard() set search_path = public;

-- client_position_report is security_invoker, so its caller (an admin) must be able to run
-- private.completed_months. It is a pure date calculation (reads no data), so this is safe.
grant execute on function private.completed_months(timestamptz, timestamptz) to authenticated;

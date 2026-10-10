-- Hardening found by the Supabase security advisor after B1 was applied to the development project.

-- SECURITY: pin the search path of the three plain trigger functions, so a caller cannot make them
-- resolve a name to an object of their own. An empty path is enough: they use no table names.
alter function app.touch_updated_at() set search_path = '';
alter function app.bump_summary_version() set search_path = '';
alter function app.audit_append_only() set search_path = '';

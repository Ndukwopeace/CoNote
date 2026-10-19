-- A student writes notes about a class only once it has started (D107). Before this, the check
-- was in the screens and services alone, so a request made straight to the database could file a
-- note under a class still to come.

-- True when the class has started. It reads the class itself, not through the caller's view of
-- classes, so a class of another course still fails on its own rule (the foreign key) and not on
-- this one.
create function app.class_started(p_class uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.class_sessions k where k.id = p_class and k.starts_at <= now())
$$;

-- Replaces the insert and update rules of the previous migration with the same ones plus the start.
drop policy notes_own_insert on public.notes;
drop policy notes_own_update on public.notes;

-- SECURITY: a student cannot file a note under a class that has not started, whatever the app sends.
create policy notes_own_insert on public.notes for insert to authenticated
  with check (student_id = auth.uid() and app.is_enrolled(course_id) and app.class_started(class_id));
-- SECURITY: the same on an edit, so a note cannot be moved to a class that has not started.
create policy notes_own_update on public.notes for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and app.is_enrolled(course_id) and app.class_started(class_id));

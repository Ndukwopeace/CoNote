-- A dashboard alert for drafts nobody can review (D112).
--
-- A draft can be reviewed only by its course's teacher. A course with no teacher, which a timetable
-- import can leave behind, collects drafts that stay in review for good, and its students never get
-- a summary. The alert "courses_without_teacher" already says a course has no teacher; this one
-- says what it costs: how many drafts are stuck. It counts drafts still in review, in a live class
-- of a course in use that has no teacher.
--
-- It is the same function as before with one more row. `create or replace` keeps the function's
-- permissions, so it stays callable by the server and by signed-in users, and its first check still
-- lets only an administrator through. SECURITY: counts only, never a draft's text or a note.

create or replace function public.admin_alerts(p_now timestamptz)
  returns table (kind text, count integer, days integer)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_days integer;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select review_alert_days into v_days from public.platform_settings;
  return query
    select 'security_events', (select count(*) from public.security_events where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    select 'ai_jobs_failed', (select count(*) from public.ai_jobs where status = 'failed' and finished_at > p_now - interval '24 hours' and finished_at <= p_now)::integer, null::integer
    union all
    select 'notifications_failed', (select count(*) from public.delivery_failures where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    select 'storage_errors', (select count(*) from public.storage_errors where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    -- New: drafts waiting in a live class of a course in use that nobody teaches.
    select 'drafts_without_teacher', (
      select count(*) from public.summaries s
        join public.courses c on c.id = s.course_id
        join public.class_sessions k on k.id = s.class_id
        where s.status = 'in_review' and c.archived_at is null and c.teacher_id is null and k.archived_at is null
    )::integer, null::integer
    union all
    select 'courses_without_teacher', (select count(*) from public.courses where archived_at is null and teacher_id is null)::integer, null::integer
    union all
    select 'classes_in_archived_courses', (select count(*) from public.class_sessions k join public.courses c on c.id = k.course_id where k.archived_at is null and c.archived_at is not null)::integer, null::integer
    union all
    select 'summaries_waiting_review', (select count(*) from public.summaries where status = 'in_review' and in_review_since is not null and in_review_since < p_now - make_interval(days => v_days))::integer, v_days
    union all
    select 'enrollment_requests_waiting', (select count(*) from public.enrollment_requests r join public.courses c on c.id = r.course_id where r.status = 'pending' and c.archived_at is null)::integer, null::integer;
end
$$;

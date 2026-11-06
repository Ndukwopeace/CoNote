-- The administrator's Analytics page (D124): two read-only functions that count. They return
-- numbers and class names only, never a note, a draft or a student's name.

-- ---------------------------------------------------------------------------------------------
-- The platform's figures for a period
-- ---------------------------------------------------------------------------------------------

-- One row of counts. `p_from` and `p_to` bound the period (from inclusive, to exclusive). The
-- figures that describe "now" (students, teachers, active and inactive accounts, drafts waiting)
-- ignore the period; the rest count what happened inside it.
--   active_7 / active_30: students and teachers who signed in within the last 7 / 30 days.
--   inactive: students and teachers with an active account who have not signed in for 30 days.
--   students_who_wrote: students who wrote at least one note in the period.
--   students_expected: students enrolled in a course that had a class in the period.
--   ai_avg_seconds: the average time from a job being queued to it finishing, for jobs that
--     succeeded; null when none did.
-- SECURITY: only an active administrator gets a row; everyone else is refused. The function reads
-- tables the caller cannot read, so it checks the caller itself.
create function public.admin_analytics(p_from timestamptz, p_to timestamptz, p_now timestamptz default now())
  returns table (
    students integer,
    teachers integer,
    new_users integer,
    active_7 integer,
    active_30 integer,
    inactive integer,
    courses integer,
    classes integer,
    notes_created integer,
    summaries_generated integer,
    summaries_published integer,
    drafts_waiting integer,
    ai_jobs_total integer,
    ai_jobs_succeeded integer,
    ai_jobs_failed integer,
    ai_avg_seconds double precision,
    students_who_wrote integer,
    students_expected integer
  )
  language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  return query
    select
      (select count(*) from public.profiles p where p.role = 'student')::integer,
      (select count(*) from public.profiles p where p.role = 'teacher')::integer,
      (select count(*) from public.profiles p
        where p.role in ('student', 'teacher') and p.created_at >= p_from and p.created_at < p_to)::integer,
      (select count(*) from public.profiles p
        where p.role in ('student', 'teacher') and p.last_active_at >= p_now - interval '7 days')::integer,
      (select count(*) from public.profiles p
        where p.role in ('student', 'teacher') and p.last_active_at >= p_now - interval '30 days')::integer,
      (select count(*) from public.profiles p
        where p.role in ('student', 'teacher') and p.status = 'active'
          and (p.last_active_at is null or p.last_active_at < p_now - interval '30 days'))::integer,
      (select count(*) from public.courses c where c.archived_at is null)::integer,
      (select count(*) from public.class_sessions k
        where k.archived_at is null and k.starts_at >= p_from and k.starts_at < p_to)::integer,
      (select count(*) from public.notes n where n.created_at >= p_from and n.created_at < p_to)::integer,
      (select count(*) from public.ai_jobs j
        where j.status = 'succeeded' and j.finished_at >= p_from and j.finished_at < p_to)::integer,
      (select count(*) from public.summaries s
        where s.published_at >= p_from and s.published_at < p_to)::integer,
      (select count(*) from public.summaries s where s.status = 'in_review')::integer,
      (select count(*) from public.ai_jobs j where j.created_at >= p_from and j.created_at < p_to)::integer,
      (select count(*) from public.ai_jobs j
        where j.created_at >= p_from and j.created_at < p_to and j.status = 'succeeded')::integer,
      (select count(*) from public.ai_jobs j
        where j.created_at >= p_from and j.created_at < p_to and j.status = 'failed')::integer,
      (select avg(extract(epoch from (j.finished_at - j.created_at)))::double precision
         from public.ai_jobs j
        where j.created_at >= p_from and j.created_at < p_to
          and j.status = 'succeeded' and j.finished_at is not null),
      (select count(distinct n.student_id) from public.notes n
        where n.created_at >= p_from and n.created_at < p_to)::integer,
      (select count(distinct e.student_id) from public.enrollments e
        where e.course_id in (
          select k.course_id from public.class_sessions k
           where k.archived_at is null and k.starts_at >= p_from and k.starts_at < p_to
        ))::integer;
end
$$;
revoke all on function public.admin_analytics(timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics(timestamptz, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Who wrote, class by class
-- ---------------------------------------------------------------------------------------------

-- One row per class that started in the period (newest first, at most 500): how many notes it has,
-- how many different students wrote them, and how many students are enrolled in its course.
-- Counts only: no names. The Notes search shows names, and records each use.
-- SECURITY: administrators only, like the function above.
create function public.admin_note_participation(p_from timestamptz, p_to timestamptz)
  returns table (
    class_id uuid,
    class_number integer,
    class_title text,
    starts_at timestamptz,
    course_id uuid,
    course_code text,
    notes integer,
    writers integer,
    enrolled integer
  )
  language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  return query
    select k.id, k.number, k.title, k.starts_at, k.course_id, c.code,
           (select count(*) from public.notes n where n.class_id = k.id)::integer,
           (select count(distinct n.student_id) from public.notes n where n.class_id = k.id)::integer,
           (select count(*) from public.enrollments e where e.course_id = k.course_id)::integer
      from public.class_sessions k
      join public.courses c on c.id = k.course_id
     where k.archived_at is null and k.starts_at >= p_from and k.starts_at < p_to
     order by k.starts_at desc, k.id
     limit 500;
end
$$;
revoke all on function public.admin_note_participation(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_note_participation(timestamptz, timestamptz) to authenticated, service_role;

-- Faster access checks (D121).
--
-- Every read of a table goes through its Row Level Security policies, and the policies on classes,
-- courses and the rest asked "is this person an administrator?", "are they enrolled in this
-- row's course?" and "do they teach it?" separately for EVERY row, each time reading the
-- profiles and enrolments tables again. A class list for a student cost 140 to 250 ms for 440
-- classes, and the cost grows with every class on the platform, not with what the person may see.
--
-- This changes how the checks are written, not what they allow:
--   * What depends only on the signed-in person (`app.is_admin()`, `auth.uid()`) is wrapped in a
--     select, so the database works it out once per request and reuses it.
--   * "Enrolled in this row's course" and "teaches this row's course" become "this row's course
--     is one of MY courses", where the list of the person's courses is worked out once.
-- The same people see the same rows; the tests in faster_access_checks.test.sql and rls.test.sql
-- check it.

-- ---------------------------------------------------------------------------------------------
-- The person's own courses, worked out once
-- ---------------------------------------------------------------------------------------------

-- The courses the signed-in student is enrolled in: a course in use, and only for an active
-- student. This is `app.is_enrolled(course)` for every course at once.
-- SECURITY: it reads only the caller's own enrolments (`auth.uid()`), so it can never list
-- another person's courses, and a visitor or a person who is not an active student gets nothing.
create function app.enrolled_course_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select e.course_id
    from public.enrollments e
    join public.courses c on c.id = e.course_id
   where e.student_id = (select auth.uid())
     and c.archived_at is null
     and (select app."current_role"()) = 'student'
$$;

-- The courses the signed-in teacher teaches: a course in use, and only for an active teacher.
-- This is `app.teaches(course)` for every course at once.
-- SECURITY: it reads only courses whose teacher is the caller, so a person who is not an active
-- teacher, and a visitor, get nothing.
create function app.taught_course_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select c.id
    from public.courses c
   where c.teacher_id = (select auth.uid())
     and c.archived_at is null
     and (select app."current_role"()) = 'teacher'
$$;

-- SECURITY: only signed-in people (and the server) may call them, like the single-course checks.
revoke all on function app.enrolled_course_ids(), app.taught_course_ids() from public, anon;
grant execute on function app.enrolled_course_ids(), app.taught_course_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Administrators: one check per request
-- ---------------------------------------------------------------------------------------------

alter policy activity_select_admin on public.activity_events using ((select app.is_admin()));
alter policy ai_jobs_select_admin on public.ai_jobs using ((select app.is_admin()));
alter policy audit_select_admin on public.audit_logs using ((select app.is_admin()));
alter policy delivery_failures_select_admin on public.delivery_failures using ((select app.is_admin()));
alter policy settings_select_admin on public.platform_settings using ((select app.is_admin()));
alter policy security_events_select_admin on public.security_events using ((select app.is_admin()));
alter policy storage_errors_select_admin on public.storage_errors using ((select app.is_admin()));
alter policy requests_select_admin on public.enrollment_requests using ((select app.is_admin()));
alter policy programme_requests_select_admin on public.programme_requests using ((select app.is_admin()));
alter policy profiles_select_admin on public.profiles using ((select app.is_admin()));

alter policy classes_admin_all on public.class_sessions
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy courses_admin_all on public.courses
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy enrollments_admin_all on public.enrollments
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy programme_courses_admin_all on public.programme_courses
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy programmes_admin_all on public.programmes
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy resources_admin_all on public.resources
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Students and teachers: "is this row's course one of mine"
-- ---------------------------------------------------------------------------------------------

alter policy classes_select_student on public.class_sessions
  using (archived_at is null and course_id in (select app.enrolled_course_ids()));
alter policy classes_select_teacher on public.class_sessions
  using (archived_at is null and course_id in (select app.taught_course_ids()));

alter policy courses_select_student on public.courses
  using (id in (select app.enrolled_course_ids()));
alter policy courses_select_teacher on public.courses
  using (id in (select app.taught_course_ids()));

alter policy enrollments_select_teacher on public.enrollments
  using (course_id in (select app.taught_course_ids()));

alter policy resources_select_student on public.resources
  using (status = 'published' and course_id in (select app.enrolled_course_ids()));
alter policy resources_select_teacher on public.resources
  using (course_id in (select app.taught_course_ids()));

alter policy summaries_select_student on public.summaries
  using (status = 'published' and course_id in (select app.enrolled_course_ids()));
alter policy summaries_select_teacher on public.summaries
  using (course_id in (select app.taught_course_ids()));

-- ---------------------------------------------------------------------------------------------
-- A person's own rows: the signed-in person is looked up once
-- ---------------------------------------------------------------------------------------------

alter policy profiles_select_own on public.profiles using (id = (select auth.uid()));
alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy enrollments_select_own on public.enrollments using (student_id = (select auth.uid()));

alter policy requests_select_own on public.enrollment_requests using (student_id = (select auth.uid()));
alter policy requests_cancel_own on public.enrollment_requests
  using (student_id = (select auth.uid()) and status = 'pending')
  with check (student_id = (select auth.uid()) and status = 'cancelled');
alter policy requests_insert_own on public.enrollment_requests
  with check (
    student_id = (select auth.uid())
    and status = 'pending'
    and decided_at is null
    and decided_by is null
    and (select app."current_role"()) = 'student'
    and app.course_accepts_requests(course_id)
    and not exists (
      select 1 from public.enrollments e
       where e.course_id = enrollment_requests.course_id and e.student_id = (select auth.uid())
    )
  );

alter policy programme_requests_select_own on public.programme_requests
  using (student_id = (select auth.uid()));

alter policy notes_own_select on public.notes using (student_id = (select auth.uid()));
alter policy notes_own_delete on public.notes using (student_id = (select auth.uid()));
alter policy notes_own_insert on public.notes
  with check (student_id = (select auth.uid()) and app.is_enrolled(course_id) and app.class_started(class_id));
alter policy notes_own_update on public.notes
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and app.is_enrolled(course_id) and app.class_started(class_id));

alter policy views_select_own on public.summary_views using (student_id = (select auth.uid()));
alter policy views_insert_own on public.summary_views
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.summaries s
       where s.id = summary_views.summary_id and s.status = 'published' and app.is_enrolled(s.course_id)
    )
  );

alter policy notifications_select_own on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_update_own on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Row Level Security (milestone B1; admin REQUIREMENTS 6.3, student REQUIREMENTS 12.2).
-- The browser talks to the database as the 'authenticated' role. Every table has RLS on, so a
-- table with no policy for a role is closed to that role. The server (service_role) bypasses RLS.

-- ---------------------------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so they can read profiles without recursing through its own policy.
-- SECURITY: each pins search_path, so a caller cannot shadow a table with one of their own.
-- ---------------------------------------------------------------------------------------------

-- The caller's role, read from their profile and never from anything the client sends.
create function app.current_role() returns public.user_role
  language sql stable security definer set search_path = public, pg_temp as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.status = 'active'
$$;

-- True when the caller is an active administrator.
create function app.is_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.current_role() = 'admin', false)
$$;

-- True when the caller is an active student enrolled in the course, which is in use.
create function app.is_enrolled(p_course uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.course_id = p_course and e.student_id = auth.uid()
      and c.archived_at is null and app.current_role() = 'student'
  )
$$;

-- True when the caller is the active teacher of the course, which is in use.
create function app.teaches(p_course uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.teacher_id = auth.uid()
      and c.archived_at is null and app.current_role() = 'teacher'
  )
$$;

-- True when a course is in use (ongoing or upcoming, not archived), whoever asks. A student who is
-- not in a course cannot read it, yet may ask to join it, so the policy below needs this check.
create function app.course_accepts_requests(p_course uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.archived_at is null and c.status <> 'completed'
  )
$$;

-- Only the API roles may call the helpers; the public role may not.
revoke all on function app.current_role(), app.is_admin(), app.is_enrolled(uuid), app.teaches(uuid), app.course_accepts_requests(uuid) from public;
grant usage on schema app to authenticated, service_role;
grant execute on function app.current_role(), app.is_admin(), app.is_enrolled(uuid), app.teaches(uuid), app.course_accepts_requests(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Default: nothing is granted. Each table then grants only what its role needs, by column.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.enrollment_requests enable row level security;
alter table public.notes enable row level security;
alter table public.summaries enable row level security;
alter table public.summary_views enable row level security;
alter table public.notifications enable row level security;
alter table public.resources enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.activity_events enable row level security;
alter table public.platform_settings enable row level security;

-- Start from zero privileges for the browser roles, whatever the platform grants by default.
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------------------------

grant select on public.profiles to authenticated;
-- A person edits only these columns of their own row. Role, status and the numbers are not here,
-- so no client can promote itself; an administrator changes them through a server function.
grant update (full_name, avatar_url, department, level, phone, notification_prefs) on public.profiles to authenticated;

-- Everyone reads their own profile.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
-- Administrators read every profile.
create policy profiles_select_admin on public.profiles for select to authenticated using (app.is_admin());
-- A person edits only their own row.
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------------------------

grant select on public.courses to authenticated;
grant insert, update, delete on public.courses to authenticated;

-- Administrators read and write every course, archived ones included.
create policy courses_admin_all on public.courses for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- A teacher reads their own courses that are in use.
create policy courses_select_teacher on public.courses for select to authenticated using (app.teaches(id));
-- A student reads the courses they are in that are in use.
create policy courses_select_student on public.courses for select to authenticated using (app.is_enrolled(id));

-- ---------------------------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------------------------

grant select on public.enrollments to authenticated;
grant insert, delete on public.enrollments to authenticated;

-- Administrators manage enrolment.
create policy enrollments_admin_all on public.enrollments for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- A student reads their own rows.
create policy enrollments_select_own on public.enrollments for select to authenticated using (student_id = auth.uid());
-- A teacher reads the rows of their own courses (IDs only; names stay in profiles).
create policy enrollments_select_teacher on public.enrollments for select to authenticated using (app.teaches(course_id));

-- ---------------------------------------------------------------------------------------------
-- class_sessions
-- ---------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.class_sessions to authenticated;

-- Administrators manage classes.
create policy classes_admin_all on public.class_sessions for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- A teacher reads the classes of their own courses, unless archived.
create policy classes_select_teacher on public.class_sessions for select to authenticated
  using (archived_at is null and app.teaches(course_id));
-- A student reads the classes of courses they are in, unless archived.
create policy classes_select_student on public.class_sessions for select to authenticated
  using (archived_at is null and app.is_enrolled(course_id));

-- ---------------------------------------------------------------------------------------------
-- enrollment_requests (D76): a student creates, reads and cancels their own; admins read; teachers
-- have no access. Approving or declining goes through app.decide_enrollment_request below.
-- ---------------------------------------------------------------------------------------------

grant select, insert on public.enrollment_requests to authenticated;
-- A student can change only the status of their own request (to cancel it).
grant update (status) on public.enrollment_requests to authenticated;

-- A student reads their own requests.
create policy requests_select_own on public.enrollment_requests for select to authenticated
  using (student_id = auth.uid());
-- Administrators read every request.
create policy requests_select_admin on public.enrollment_requests for select to authenticated using (app.is_admin());
-- A student asks for themselves, as pending, for a course in use they are not in.
create policy requests_insert_own on public.enrollment_requests for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and decided_at is null and decided_by is null
    and app.current_role() = 'student'
    and app.course_accepts_requests(course_id)
    and not exists (
      select 1 from public.enrollments e where e.course_id = enrollment_requests.course_id and e.student_id = auth.uid()
    )
  );
-- A student may move their own pending request to cancelled, and nothing else.
create policy requests_cancel_own on public.enrollment_requests for update to authenticated
  using (student_id = auth.uid() and status = 'pending')
  with check (student_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------------------------
-- notes: only the author. There is no administrator or teacher policy, so those roles read nothing.
-- ---------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.notes to authenticated;

-- An author reads, writes and deletes their own notes, only in a course they are in.
create policy notes_own_select on public.notes for select to authenticated using (student_id = auth.uid());
create policy notes_own_insert on public.notes for insert to authenticated
  with check (student_id = auth.uid() and app.is_enrolled(course_id));
create policy notes_own_update on public.notes for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid() and app.is_enrolled(course_id));
create policy notes_own_delete on public.notes for delete to authenticated using (student_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- summaries
-- ---------------------------------------------------------------------------------------------

grant select on public.summaries to authenticated;
-- A teacher edits the draft's text only. Status, publishing and counts change through functions.
grant update (overview, key_concepts, confusion_areas, key_topics) on public.summaries to authenticated;

-- A student reads published summaries of courses they are in. Draft text never reaches them.
create policy summaries_select_student on public.summaries for select to authenticated
  using (status = 'published' and app.is_enrolled(course_id));
-- A teacher reads the summaries of their own courses.
create policy summaries_select_teacher on public.summaries for select to authenticated using (app.teaches(course_id));
-- A teacher edits a draft that is waiting for review, in their own course.
create policy summaries_update_teacher on public.summaries for update to authenticated
  using (status = 'in_review' and app.teaches(course_id))
  with check (status = 'in_review' and app.teaches(course_id));
-- There is no administrator policy: an administrator monitors through the metadata view below.

-- View counts: a student records and reads their own, for published summaries they can see.
grant select, insert on public.summary_views to authenticated;
create policy views_select_own on public.summary_views for select to authenticated using (student_id = auth.uid());
create policy views_insert_own on public.summary_views for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.status = 'published' and app.is_enrolled(s.course_id)
    )
  );

-- ---------------------------------------------------------------------------------------------
-- notifications: a person reads their own and marks them read. The server writes them.
-- ---------------------------------------------------------------------------------------------

grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.resources to authenticated;

-- Administrators manage resources.
create policy resources_admin_all on public.resources for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- A teacher reads the resources of their own courses.
create policy resources_select_teacher on public.resources for select to authenticated using (app.teaches(course_id));
-- A student reads the published resources of courses they are in.
create policy resources_select_student on public.resources for select to authenticated
  using (status = 'published' and app.is_enrolled(course_id));

-- ---------------------------------------------------------------------------------------------
-- Operations tables: administrators read; nobody writes from a browser.
-- ---------------------------------------------------------------------------------------------

grant select on public.ai_jobs, public.audit_logs, public.activity_events, public.platform_settings to authenticated;

create policy ai_jobs_select_admin on public.ai_jobs for select to authenticated using (app.is_admin());
create policy audit_select_admin on public.audit_logs for select to authenticated using (app.is_admin());
create policy activity_select_admin on public.activity_events for select to authenticated using (app.is_admin());
create policy settings_select_admin on public.platform_settings for select to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------------------------
-- Views that expose counts and metadata, never content. They run with the owner's rights, so each
-- filters on the caller itself.
-- ---------------------------------------------------------------------------------------------

-- Teachers' names for the students in their course (name and avatar only, not email or phone).
create view public.course_teachers with (security_barrier = true) as
  select p.id, p.full_name, p.avatar_url, c.id as course_id
  from public.profiles p
  join public.courses c on c.teacher_id = p.id
  where c.archived_at is null
    and (app.is_enrolled(c.id) or app.is_admin());
grant select on public.course_teachers to authenticated;

-- The courses a signed-in student may ask to join (FR-ENR): in use, with the teacher's name and the
-- student's own standing. Code, title, status and the teacher's name only.
create view public.joinable_courses with (security_barrier = true) as
  select c.id, c.code, c.title, c.status, t.full_name as teacher_name,
         case
           when exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid()) then 'enrolled'
           when exists (select 1 from public.enrollment_requests r where r.course_id = c.id and r.student_id = auth.uid() and r.status = 'pending') then 'pending'
           else 'none'
         end as membership
  from public.courses c
  left join public.profiles t on t.id = c.teacher_id
  where app.course_accepts_requests(c.id) and app.current_role() = 'student';
grant select on public.joinable_courses to authenticated;

-- How many notes, from how many students, each class has: counts only, for administrators and the
-- class's own teacher (teacher REQUIREMENTS section 2, D74).
create view public.class_note_counts with (security_barrier = true) as
  select n.class_id, n.course_id, count(*)::integer as note_count, count(distinct n.student_id)::integer as student_count
  from public.notes n
  where app.is_admin() or app.teaches(n.course_id)
  group by n.class_id, n.course_id;
grant select on public.class_note_counts to authenticated;

-- The summary pipeline without any draft text, for administrators.
create view public.summary_monitor with (security_barrier = true) as
  select s.id, s.class_id, s.course_id, s.status, s.notes_analyzed_count, s.students_analyzed_count,
         s.in_review_since, s.reviewed_by, s.published_at
  from public.summaries s
  where app.is_admin();
grant select on public.summary_monitor to authenticated;

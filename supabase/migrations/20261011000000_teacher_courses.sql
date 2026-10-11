-- What the teacher portal's course screens need from the database (milestone B3.1, D88): one list
-- of the teacher's courses with the counts a row shows, and one list of their classes with where
-- each summary is. A teacher cannot read students' notes, so the note count comes from here: a
-- number only, never any text.
--
-- Like the admin views, these run with the owner's rights, so each filters on the caller itself.
-- SECURITY: `app.teaches` is true only for the signed-in teacher of a course that is not archived,
-- so every other caller (another teacher, a student, an administrator, a visitor) gets no row.

-- ---------------------------------------------------------------------------------------------
-- My courses
-- ---------------------------------------------------------------------------------------------

create view public.teacher_courses with (security_barrier = true) as
  select c.id, c.code, c.title, c.status,
         -- Classes still in use.
         (select count(*) from public.class_sessions k
           where k.course_id = c.id and k.archived_at is null)::integer as class_count,
         -- Summaries waiting for this teacher, in classes still in use.
         (select count(*) from public.summaries s
            join public.class_sessions k on k.id = s.class_id
           where s.course_id = c.id and s.status = 'in_review' and k.archived_at is null)::integer as waiting_for_review_count
  from public.courses c
  where app.teaches(c.id);
revoke all on public.teacher_courses from public, anon;
grant select on public.teacher_courses to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A course's classes
-- ---------------------------------------------------------------------------------------------

create view public.teacher_classes with (security_barrier = true) as
  select k.id, k.course_id, k.number, k.title, k.starts_at,
         -- A count only: the teacher never reads the notes themselves.
         (select count(*) from public.notes n where n.class_id = k.id)::integer as note_count,
         -- Null until the pipeline has made a summary.
         s.id as summary_id, s.status as summary_status, s.published_at
  from public.class_sessions k
  left join public.summaries s on s.class_id = k.id
  where k.archived_at is null and app.teaches(k.course_id);
revoke all on public.teacher_classes from public, anon;
grant select on public.teacher_classes to authenticated;

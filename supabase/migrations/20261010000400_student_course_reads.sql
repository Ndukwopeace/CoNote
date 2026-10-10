-- What the student portal needs to read courses and ask to join them (B2.2).

-- How many students are in each course. A student may read only their own enrolment row, so the
-- course card's "N students" cannot be counted from the table. This view gives the count and
-- nothing else: no names, no emails. Like the other views, it runs with the owner's rights and
-- filters on the caller itself, so it must not be switched to security_invoker.
create view public.course_student_counts with (security_barrier = true) as
  select e.course_id, count(*)::integer as student_count
  from public.enrollments e
  where app.is_enrolled(e.course_id) or app.teaches(e.course_id) or app.is_admin()
  group by e.course_id;

-- Signed-in people only; the view's own filter decides which courses they see.
grant select on public.course_student_counts to authenticated;

-- A student's join request names the course only; the student is whoever is signed in. Without
-- this default the browser would have to send its own ID. The insert policy still checks that the
-- ID equals auth.uid(), so sending someone else's is refused.
alter table public.enrollment_requests alter column student_id set default auth.uid();

-- What the admin console's course screens need from the database (milestone B2.6, D84): one list
-- view with the counts a row shows, a check that a course's teacher is really an active teacher,
-- and numbering for classes.

-- ---------------------------------------------------------------------------------------------
-- The course list: each course with its teacher's name and the figures a row shows. Like the other
-- views it runs with the owner's rights, so it filters on the caller itself: only an
-- administrator sees any row.
-- ---------------------------------------------------------------------------------------------

create view public.admin_courses with (security_barrier = true) as
  select c.id, c.code, c.title, c.description, c.department, c.status, c.created_at, c.archived_at,
         c.teacher_id, t.full_name as teacher_name,
         -- Students in the course.
         (select count(*) from public.enrollments e where e.course_id = c.id)::integer as student_count,
         -- Classes still in use.
         (select count(*) from public.class_sessions k where k.course_id = c.id and k.archived_at is null)::integer as class_count,
         -- Requests to join that wait for a decision (D76).
         (select count(*) from public.enrollment_requests r where r.course_id = c.id and r.status = 'pending')::integer as pending_request_count
  from public.courses c
  left join public.profiles t on t.id = c.teacher_id
  where app.is_admin();
revoke all on public.admin_courses from public, anon;
grant select on public.admin_courses to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A course's teacher must be an active teacher at the moment they are assigned. A teacher who is
-- deactivated later stays on the course until an administrator changes it, so the check runs only
-- when the teacher changes. SECURITY: this holds even for a request that skips the console.
-- ---------------------------------------------------------------------------------------------

create function app.check_course_teacher() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only a new or changed teacher is checked.
  if new.teacher_id is not null and (tg_op = 'INSERT' or new.teacher_id is distinct from old.teacher_id) then
    if not exists (
      select 1 from public.profiles p where p.id = new.teacher_id and p.role = 'teacher' and p.status = 'active'
    ) then
      raise exception 'teacher must be active' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger courses_check_teacher before insert or update of teacher_id on public.courses
  for each row execute function app.check_course_teacher();

-- ---------------------------------------------------------------------------------------------
-- Class numbers: when a class is added without one, it takes the next number in its course, counting
-- archived classes, so a number is never reused. A lock per course stops two classes added at the
-- same moment from taking the same number.
-- ---------------------------------------------------------------------------------------------

create function app.assign_class_number() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.number is null then
    -- One class at a time per course, until this transaction ends.
    perform pg_advisory_xact_lock(hashtext(new.course_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.class_sessions where course_id = new.course_id;
  end if;
  return new;
end
$$;
create trigger class_sessions_number before insert on public.class_sessions
  for each row execute function app.assign_class_number();

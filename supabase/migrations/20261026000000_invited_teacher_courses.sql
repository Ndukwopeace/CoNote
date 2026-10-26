-- Courses chosen when a teacher is invited (D116).
--
-- An administrator can pick the courses a new teacher will teach in the same step as the
-- invitation. A course may only be given to an ACTIVE teacher (app.check_course_teacher), and an
-- invited teacher is pending until they accept, so the choice is kept here and handed over by
-- accept_invitation() at the moment the teacher becomes active. That way the rule on courses stays
-- exactly as it was, and nothing is half done if the invitation is never accepted: the rows go
-- with the account.

-- ---------------------------------------------------------------------------------------------
-- The choice
-- ---------------------------------------------------------------------------------------------

create table public.invited_courses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  primary key (user_id, course_id)
);
-- Lets "who is waiting for this course" use an index, and the cascade above stay fast.
create index invited_courses_by_course on public.invited_courses (course_id);

-- SECURITY: no policy is written and nothing is granted, so a signed-in person cannot read or
-- write the table whatever their role: a teacher cannot give themselves a course by inserting a
-- row. Only the server key (the invite function) and the security-definer functions touch it.
alter table public.invited_courses enable row level security;
revoke all on public.invited_courses from public, anon, authenticated;

-- What an administrator sees: the courses in use that an invited person will get, by code. A
-- course archived since the invitation is left out, as it will not be handed over.
create view public.admin_invited_courses with (security_barrier = true) as
  select ic.user_id, c.id as course_id, c.code, c.title
  from public.invited_courses ic
  join public.courses c on c.id = ic.course_id
  where c.archived_at is null and app.is_admin();
revoke all on public.admin_invited_courses from public, anon;
grant select on public.admin_invited_courses to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The hand-over
-- ---------------------------------------------------------------------------------------------

-- The same function as before with one more step. `create or replace` keeps its permissions.
-- SECURITY: it still acts only on the caller's own row and only from "pending", so a withdrawn
-- invitation (inactive) or a suspension is never undone, and a teacher cannot choose their own
-- courses: they get exactly what an administrator wrote at the invitation.
create or replace function public.accept_invitation() returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.user_role;
begin
  update public.profiles set status = 'active'
    where id = auth.uid() and status = 'pending'
    returning role into v_role;
  -- Nothing to accept.
  if not found then
    return;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_role, 'user.status_changed', 'user', auth.uid()::text,
          jsonb_build_object('from', 'pending', 'to', 'active'));
  -- A teacher now gets the courses chosen for them. The account is active by this point, so the
  -- course rule accepts them. A course archived since then is skipped; one another teacher has
  -- changes hands, as when an administrator assigns it. Nobody else is given anything.
  if v_role = 'teacher' then
    update public.courses set teacher_id = auth.uid()
      where archived_at is null
        and id in (select ic.course_id from public.invited_courses ic where ic.user_id = auth.uid());
    -- The choice is used up.
    delete from public.invited_courses where user_id = auth.uid();
  end if;
end
$$;

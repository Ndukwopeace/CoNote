-- Joining a programme needs an administrator's approval (D106), and a student belongs to one
-- programme. This replaces the self-service join_programme() of the previous migration: a student
-- asks, an administrator approves, and only then are the courses added.

-- SECURITY: a student must not be able to enrol themselves in a programme's courses.
drop function public.join_programme(uuid);

-- A student's request to join a programme. At most one is waiting per student at a time.
create table public.programme_requests (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status public.request_status not null default 'pending',
  -- The moment of writing, not of the transaction, so two requests made together still have an order.
  created_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
-- The "one request waiting" rule.
create unique index programme_requests_one_pending on public.programme_requests (student_id) where status = 'pending';
create index programme_requests_by_programme on public.programme_requests (programme_id);

-- Row Level Security: a student reads only their own requests, an administrator reads all, and
-- nobody writes the table directly: the functions below make every change.
alter table public.programme_requests enable row level security;
revoke all on public.programme_requests from public, anon, authenticated;
grant select on public.programme_requests to authenticated;
create policy programme_requests_select_own on public.programme_requests for select to authenticated
  using (student_id = auth.uid());
create policy programme_requests_select_admin on public.programme_requests for select to authenticated
  using (app.is_admin());

-- Changes are written to the audit log like course requests are.
create trigger audit_programme_requests after insert or update on public.programme_requests
  for each row execute function app.audit_change();

-- ---------------------------------------------------------------------------------------------
-- Views, rebuilt with the request standing
-- ---------------------------------------------------------------------------------------------

drop view public.joinable_programmes;
drop view public.admin_programmes;

-- The administrator's list, with how many requests wait on each programme.
create view public.admin_programmes with (security_barrier = true) as
  select p.id, p.code, p.name, p.open_enrolment, p.archived_at, p.created_at,
         (select count(*) from public.programme_courses pc where pc.programme_id = p.id)::integer as course_count,
         (select count(*) from public.profiles s where s.programme_id = p.id and s.role = 'student')::integer as student_count,
         (select count(*) from public.programme_requests r where r.programme_id = p.id and r.status = 'pending')::integer as pending_request_count
  from public.programmes p
  where app.is_admin();
revoke all on public.admin_programmes from public, anon;
grant select on public.admin_programmes to authenticated;

-- The requests waiting for an administrator, with who asked and for what.
create view public.admin_programme_requests with (security_barrier = true) as
  select r.id, r.status, r.created_at,
         r.programme_id, p.code as programme_code, p.name as programme_name,
         r.student_id, s.full_name as student_name, s.email as student_email
  from public.programme_requests r
  join public.programmes p on p.id = r.programme_id
  join public.profiles s on s.id = r.student_id
  where app.is_admin();
revoke all on public.admin_programme_requests from public, anon;
grant select on public.admin_programme_requests to authenticated;

-- What a student is offered: the open programmes, the courses in use joining would add, and the
-- student's standing with each: nothing yet, asked and waiting, joined, or declined.
create view public.joinable_programmes with (security_barrier = true) as
  select p.id, p.code, p.name,
         (select count(*) from public.programme_courses pc join public.courses c on c.id = pc.course_id
           where pc.programme_id = p.id and c.archived_at is null and c.status <> 'completed')::integer as course_count,
         coalesce((select array_agg(c.code order by c.code) from public.programme_courses pc join public.courses c on c.id = pc.course_id
           where pc.programme_id = p.id and c.archived_at is null and c.status <> 'completed'), array[]::text[]) as course_codes,
         case
           when exists (select 1 from public.profiles me where me.id = auth.uid() and me.programme_id = p.id) then 'enrolled'
           when exists (select 1 from public.programme_requests r where r.student_id = auth.uid() and r.programme_id = p.id and r.status = 'pending') then 'pending'
           when (select r.status from public.programme_requests r where r.student_id = auth.uid() and r.programme_id = p.id
                  order by r.created_at desc, r.id desc limit 1) = 'declined' then 'declined'
           else 'none'
         end as membership,
         (select r.id from public.programme_requests r where r.student_id = auth.uid() and r.programme_id = p.id and r.status = 'pending') as request_id
  from public.programmes p
  where p.open_enrolment and p.archived_at is null and app.current_role() = 'student';
revoke all on public.joinable_programmes from public, anon;
grant select on public.joinable_programmes to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Asking, withdrawing and deciding
-- ---------------------------------------------------------------------------------------------

-- A student asks to join an open programme. Returns the request's ID.
-- SECURITY: only a student passes, for themselves, and only one programme is ever theirs. An
-- unknown, closed or archived programme all answer "not found". The profile is read here, on the
-- server, so the one-programme rule cannot be skipped by a different request.
create function public.request_programme(p_programme uuid) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if app.current_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.programmes p
    where p.id = p_programme and p.open_enrolment and p.archived_at is null
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- One programme per student.
  if exists (select 1 from public.profiles where id = auth.uid() and programme_id is not null) then
    raise exception 'already in a programme' using errcode = '23505';
  end if;
  -- One request waiting at a time.
  if exists (select 1 from public.programme_requests where student_id = auth.uid() and status = 'pending') then
    raise exception 'request already waiting' using errcode = '23505';
  end if;
  insert into public.programme_requests (programme_id, student_id)
    values (p_programme, auth.uid()) returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.request_programme(uuid) from public, anon;
grant execute on function public.request_programme(uuid) to authenticated;

-- A student withdraws their own waiting request.
create function public.cancel_programme_request(p_request uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status public.request_status;
begin
  if app.current_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- SECURITY: only the student's own request is found; anyone else's answers "not found".
  select status into v_status from public.programme_requests
    where id = p_request and student_id = auth.uid() for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'already decided' using errcode = '23505';
  end if;
  update public.programme_requests set status = 'cancelled' where id = p_request;
end
$$;
revoke all on function public.cancel_programme_request(uuid) from public, anon;
grant execute on function public.cancel_programme_request(uuid) to authenticated;

-- An administrator approves or declines a request. Approving enrols the student in every course
-- of the programme in use and remembers the programme on their profile.
create function public.decide_programme_request(p_request uuid, p_decision text)
  returns public.programme_requests
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.programme_requests;
begin
  -- SECURITY: only administrators decide.
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  -- Lock the row so two administrators cannot both decide it.
  select * into v_request from public.programme_requests where id = p_request for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'already decided' using errcode = '23505';
  end if;
  if p_decision = 'approved' then
    -- An archived programme takes no one new.
    if exists (select 1 from public.programmes where id = v_request.programme_id and archived_at is not null) then
      raise exception 'programme archived' using errcode = '23514';
    end if;
    -- SECURITY: only an active student can be enrolled, whatever the request says.
    if not exists (
      select 1 from public.profiles p where p.id = v_request.student_id and p.role = 'student' and p.status = 'active'
    ) then
      raise exception 'account cannot be enrolled' using errcode = '22023';
    end if;
    -- One programme per student, checked again at the moment of approval.
    if exists (
      select 1 from public.profiles p
      where p.id = v_request.student_id and p.programme_id is not null and p.programme_id <> v_request.programme_id
    ) then
      raise exception 'already in a programme' using errcode = '23505';
    end if;
  end if;
  update public.programme_requests
    set status = p_decision::public.request_status, decided_at = now(), decided_by = auth.uid()
    where id = p_request
    returning * into v_request;
  if p_decision = 'approved' then
    insert into public.enrollments (course_id, student_id)
      select pc.course_id, v_request.student_id
      from public.programme_courses pc
      join public.courses c on c.id = pc.course_id
      where pc.programme_id = v_request.programme_id and c.archived_at is null and c.status <> 'completed'
    on conflict do nothing;
    update public.profiles set programme_id = v_request.programme_id where id = v_request.student_id;
  end if;
  return v_request;
end
$$;
revoke all on function public.decide_programme_request(uuid, text) from public, anon;
grant execute on function public.decide_programme_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Removing a student from a programme
-- ---------------------------------------------------------------------------------------------

-- The students who joined each programme, for the administrator's list.
create view public.admin_programme_members with (security_barrier = true) as
  select s.programme_id, s.id as student_id, s.full_name as student_name, s.email as student_email
  from public.profiles s
  where s.programme_id is not null and s.role = 'student' and app.is_admin();
revoke all on public.admin_programme_members from public, anon;
grant select on public.admin_programme_members to authenticated;

-- An administrator takes a student out of their programme: the programme is cleared from their
-- profile and they leave the programme's courses. Their notes are kept. Returns how many courses
-- they left. The student may then ask to join a programme again.
-- SECURITY: only an administrator passes, and only a student who is in a programme is found.
create function public.remove_from_programme(p_student uuid) returns integer
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_programme uuid;
  v_removed integer;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select programme_id into v_programme from public.profiles
    where id = p_student and role = 'student' for update;
  if v_programme is null then
    raise exception 'not in a programme' using errcode = 'P0002';
  end if;
  delete from public.enrollments e
    where e.student_id = p_student
      and e.course_id in (select pc.course_id from public.programme_courses pc where pc.programme_id = v_programme);
  get diagnostics v_removed = row_count;
  update public.profiles set programme_id = null where id = p_student;
  -- Recorded with a count and no content.
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'admin', 'programme_members.remove', 'programme_members', p_student::text,
            jsonb_build_object('coursesRemoved', v_removed));
  return v_removed;
end
$$;
revoke all on function public.remove_from_programme(uuid) from public, anon;
grant execute on function public.remove_from_programme(uuid) to authenticated;

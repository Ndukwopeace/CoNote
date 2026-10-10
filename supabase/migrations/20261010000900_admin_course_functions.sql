-- More for the admin console's course screens (milestone B2.6, D84): the departments the filters
-- offer, a case-insensitive lookup for bulk enrolment, and a stricter way to approve a request.

-- ---------------------------------------------------------------------------------------------
-- The departments in use by an account or a course, for the filters and the course form. A view,
-- because the API cannot ask for distinct values. Only an administrator sees any row.
-- ---------------------------------------------------------------------------------------------

create view public.admin_departments with (security_barrier = true) as
  select distinct d.department
  from (
    select department from public.profiles
    union all
    select department from public.courses
  ) d
  where d.department is not null and app.is_admin();
revoke all on public.admin_departments from public, anon;
grant select on public.admin_departments to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Bulk enrolment looks people up by email or student number, in any letter case. SECURITY: only an
-- administrator passes the first check, and only the columns the enrolment screen shows come back.
-- ---------------------------------------------------------------------------------------------

create function public.admin_match_people(p_identifiers text[])
  returns table (id uuid, role public.user_role, status public.account_status, full_name text, email text, student_number text)
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only administrators look people up.
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- A pasted list, not a data export.
  if coalesce(array_length(p_identifiers, 1), 0) > 1000 then
    raise exception 'too many identifiers' using errcode = '22023';
  end if;
  return query
    select p.id, p.role, p.status, p.full_name, p.email, p.student_number
    from public.profiles p
    where lower(p.email) = any (select lower(btrim(v)) from unnest(p_identifiers) v)
       or lower(p.student_number) = any (select lower(btrim(v)) from unnest(p_identifiers) v);
end
$$;
revoke all on function public.admin_match_people(text[]) from public, anon, authenticated;
grant execute on function public.admin_match_people(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Approving a request enrols the student, so the student must be an active student. This replaces
-- the function from migration 0200 with the same checks plus that one.
-- ---------------------------------------------------------------------------------------------

create or replace function public.decide_enrollment_request(p_request uuid, p_decision text)
  returns public.enrollment_requests
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request public.enrollment_requests;
  v_course public.courses;
begin
  -- Only administrators decide.
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Only these two decisions exist.
  if p_decision not in ('approved', 'declined') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  -- Lock the row so two administrators cannot both decide it.
  select * into v_request from public.enrollment_requests where id = p_request for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- A request is decided once.
  if v_request.status <> 'pending' then
    raise exception 'already decided' using errcode = '23505';
  end if;
  -- An archived course takes no changes.
  select * into v_course from public.courses where id = v_request.course_id;
  if v_course.archived_at is not null then
    raise exception 'course archived' using errcode = '23514';
  end if;
  -- SECURITY: only an active student can be enrolled, whatever the request says.
  if p_decision = 'approved' and not exists (
    select 1 from public.profiles p where p.id = v_request.student_id and p.role = 'student' and p.status = 'active'
  ) then
    raise exception 'account cannot be enrolled' using errcode = '22023';
  end if;
  -- Record the decision.
  update public.enrollment_requests
    set status = p_decision::public.request_status, decided_at = now(), decided_by = auth.uid()
    where id = p_request
    returning * into v_request;
  -- Approving enrols the student, unless an administrator already did.
  if p_decision = 'approved' then
    insert into public.enrollments (course_id, student_id)
    values (v_request.course_id, v_request.student_id)
    on conflict do nothing;
  end if;
  return v_request;
end
$$;

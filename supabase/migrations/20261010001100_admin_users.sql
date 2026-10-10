-- What the admin console's user screens and the invitation flow need from the database (milestone
-- B2.7, D86): when each account was last active, a user list view, a way for an administrator to
-- edit a profile, and a way for an invited person to accept the invitation.

-- ---------------------------------------------------------------------------------------------
-- Last activity: the time of the account's latest sign-in, copied from Supabase Auth by a trigger.
-- A column of its own, so the console never reads the auth schema and a test can set it.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles add column last_active_at timestamptz;

create function app.sync_last_active() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles set last_active_at = new.last_sign_in_at where id = new.id;
  return new;
end
$$;
create trigger on_auth_user_signed_in after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function app.sync_last_active();

-- ---------------------------------------------------------------------------------------------
-- The user list: each account with its figures. `course_ids` holds every course the account is
-- enrolled in (students) or teaches (teachers), for the course filter; `course_count` counts only
-- the courses in use. Like the other views it runs with the owner's rights, so it filters on the
-- caller itself: only an administrator sees any row.
-- ---------------------------------------------------------------------------------------------

create view public.admin_users with (security_barrier = true) as
  select p.id, p.role, p.status, p.full_name, p.email, p.student_number, p.staff_number,
         p.department, p.level, p.phone, p.created_at, p.last_active_at,
         coalesce(m.course_ids, '{}'::uuid[]) as course_ids,
         coalesce(m.course_count, 0)::integer as course_count
  from public.profiles p
  left join lateral (
    select array_agg(x.course_id) as course_ids,
           count(*) filter (where x.in_use) as course_count
    from (
      select e.course_id, c.archived_at is null as in_use
      from public.enrollments e join public.courses c on c.id = e.course_id
      where p.role = 'student' and e.student_id = p.id
      union all
      select c.id, c.archived_at is null
      from public.courses c
      where p.role = 'teacher' and c.teacher_id = p.id
    ) x
  ) m on true
  where app.is_admin();
revoke all on public.admin_users from public, anon;
grant select on public.admin_users to authenticated;

-- ---------------------------------------------------------------------------------------------
-- An administrator edits someone's profile. A person can edit their own name and details through
-- the API, but not anyone else's, and never a number or a role; this is the one way to change a
-- number. SECURITY: only an administrator passes the first check, and the change is audited.
-- ---------------------------------------------------------------------------------------------

create function public.admin_update_profile(
  p_user uuid, p_full_name text, p_department text, p_level text, p_phone text,
  p_student_number text, p_staff_number text
) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only administrators edit other people.
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
    set full_name = p_full_name, department = p_department, level = p_level, phone = p_phone,
        student_number = p_student_number, staff_number = p_staff_number
    where id = p_user;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- Which fields were offered, never their values.
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'user.updated', 'user', p_user::text,
          jsonb_build_object('fields', 'fullName,department,level,phone,studentNumber,staffNumber'));
end
$$;
revoke all on function public.admin_update_profile(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- An invited person accepts the invitation by choosing a password: the app calls this while the
-- link's temporary session is open. It moves the caller from "pending" to "active" and records
-- it; for anyone else it does nothing. SECURITY: it acts only on the caller's own row, and only
-- from "pending", so a withdrawn invitation (inactive) or a suspension is never undone.
-- ---------------------------------------------------------------------------------------------

create function public.accept_invitation() returns void
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
end
$$;
revoke all on function public.accept_invitation() from public, anon, authenticated;
grant execute on function public.accept_invitation() to authenticated;

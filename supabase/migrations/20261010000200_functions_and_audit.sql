-- Server-side rules (milestone B1): new accounts, the two decisions that change several tables at
-- once, summary housekeeping, and the append-only audit log.

-- ---------------------------------------------------------------------------------------------
-- New accounts
-- ---------------------------------------------------------------------------------------------

-- Creates the profile when Supabase Auth creates a login. SECURITY: the role comes from
-- raw_app_meta_data, which only the server (the invite function) can set. A browser sign-up can
-- put anything in raw_user_meta_data, so that is never read for the role: an attacker cannot
-- sign up as an administrator.
create function app.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Insert the profile row; public sign-up gives a student, an invitation can name another role.
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'student'),
    coalesce((new.raw_app_meta_data ->> 'status')::public.account_status, 'active')
  );
  return new;
end
$$;

-- Runs after each new login.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------------------------

-- Stamps notes with the time of their last edit.
create function app.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;
create trigger notes_touch before update on public.notes
  for each row execute function app.touch_updated_at();

-- Bumps a summary's version on every edit, so a save made from a stale copy can be refused.
create function app.bump_summary_version() returns trigger language plpgsql as $$
begin
  new.version = old.version + 1;
  return new;
end
$$;
create trigger summaries_version before update on public.summaries
  for each row execute function app.bump_summary_version();

-- Keeps class_sessions.summary_status equal to the summary's status.
create function app.sync_class_summary_status() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.class_sessions set summary_status = new.status where id = new.class_id;
  return new;
end
$$;
create trigger summaries_sync after insert or update of status on public.summaries
  for each row execute function app.sync_class_summary_status();

-- ---------------------------------------------------------------------------------------------
-- Decisions that touch several tables. They run as the owner, so each checks the caller itself.
-- ---------------------------------------------------------------------------------------------

-- An administrator approves or declines a student's request. Approving adds the enrolment in the
-- same transaction (D76). SECURITY: only an active administrator passes the first check.
create function public.decide_enrollment_request(p_request uuid, p_decision text)
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

-- A teacher publishes a draft they have reviewed (teacher REQUIREMENTS section 9). The version
-- argument must match, so an edit made elsewhere is never overwritten. SECURITY: only the
-- course's own teacher passes, and only from in_review.
create function public.publish_summary(p_summary uuid, p_version integer)
  returns public.summaries
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_summary public.summaries;
begin
  -- Lock the summary while it is checked and changed.
  select * into v_summary from public.summaries where id = p_summary for update;
  -- Unknown, or not this teacher's course: the same answer, so existence is not revealed.
  if not found or not app.teaches(v_summary.course_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- Only a draft in review can be published.
  if v_summary.status <> 'in_review' then
    raise exception 'not in review' using errcode = '23514';
  end if;
  -- A stale copy is refused.
  if v_summary.version <> p_version then
    raise exception 'draft changed' using errcode = '40001';
  end if;
  -- Publish, and record who and when.
  update public.summaries
    set status = 'published', reviewed_by = auth.uid(), published_at = now()
    where id = p_summary
    returning * into v_summary;
  return v_summary;
end
$$;

-- Only signed-in users may call the two functions; the checks inside decide the rest.
revoke all on function public.decide_enrollment_request(uuid, text), public.publish_summary(uuid, integer) from public;
grant execute on function public.decide_enrollment_request(uuid, text), public.publish_summary(uuid, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Audit log: written by triggers, never by a browser, and append-only.
-- ---------------------------------------------------------------------------------------------

-- Writes one audit row for a change to a watched table.
create function app.audit_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_changed jsonb;
begin
  -- For updates, note which columns changed (names only, never values, so no note or draft text leaks).
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(key order by key), '[]'::jsonb) into v_changed
    from jsonb_each(to_jsonb(new)) where to_jsonb(new) -> key is distinct from v_old -> key;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, course_id, class_id, metadata)
  values (
    auth.uid(),
    (select p.role from public.profiles p where p.id = auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'student_id'),
    case when tg_table_name = 'courses' then (v_row ->> 'id')::uuid else (v_row ->> 'course_id')::uuid end,
    case when tg_table_name = 'class_sessions' then (v_row ->> 'id')::uuid else (v_row ->> 'class_id')::uuid end,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else '{}'::jsonb end
  );
  return coalesce(new, old);
end
$$;

-- Watch the tables whose changes an administrator needs to account for.
create trigger audit_courses after insert or update or delete on public.courses
  for each row execute function app.audit_change();
create trigger audit_class_sessions after insert or update or delete on public.class_sessions
  for each row execute function app.audit_change();
create trigger audit_enrollments after insert or delete on public.enrollments
  for each row execute function app.audit_change();
create trigger audit_requests after insert or update on public.enrollment_requests
  for each row execute function app.audit_change();
create trigger audit_profiles after update on public.profiles
  for each row when (old.role is distinct from new.role or old.status is distinct from new.status)
  execute function app.audit_change();
create trigger audit_summaries after update on public.summaries
  for each row when (old.status is distinct from new.status)
  execute function app.audit_change();

-- Refuses any edit or delete of an audit row, whoever asks. SECURITY: stops anyone covering their
-- tracks, including a compromised server key.
create function app.audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end
$$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function app.audit_append_only();

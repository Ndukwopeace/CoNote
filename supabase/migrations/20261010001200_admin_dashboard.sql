-- What the admin console's dashboard needs from the database (milestone B2.8, D87): somewhere for the
-- platform's own failure logs to live, a record of real activity, and three read-only functions
-- that count things for an administrator. None of them can read a note, a draft or a person's
-- details: they count.

-- ---------------------------------------------------------------------------------------------
-- Failure logs. Written by the server (the notification sender, the storage layer and the sign-in
-- watcher, as those are built); an administrator reads them to see what needs attention. Unlike the
-- audit log they can be cleared, so a test can start from nothing.
-- ---------------------------------------------------------------------------------------------

-- A notification that could not be delivered.
create table public.delivery_failures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
-- A storage operation (an upload, say) that failed.
create table public.storage_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
-- A security-relevant event, such as repeated failed sign-ins. `action` names what happened.
create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  created_at timestamptz not null default now()
);
create index delivery_failures_created_idx on public.delivery_failures (created_at desc);
create index storage_errors_created_idx on public.storage_errors (created_at desc);
create index security_events_created_idx on public.security_events (created_at desc);

alter table public.delivery_failures enable row level security;
alter table public.storage_errors enable row level security;
alter table public.security_events enable row level security;
revoke all on public.delivery_failures, public.storage_errors, public.security_events from public, anon, authenticated;
grant select on public.delivery_failures, public.storage_errors, public.security_events to authenticated;
create policy delivery_failures_select_admin on public.delivery_failures for select to authenticated using (app.is_admin());
create policy storage_errors_select_admin on public.storage_errors for select to authenticated using (app.is_admin());
create policy security_events_select_admin on public.security_events for select to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------------------------
-- Activity: what the charts count. Written by triggers, so the figures come from what really
-- happened. Only the kind, the time and who/where are kept, never content.
-- ---------------------------------------------------------------------------------------------

-- A student wrote a note.
create function app.log_note_created() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (user_id, kind, course_id, class_id)
  values (new.student_id, 'note_created', new.course_id, new.class_id);
  return new;
end
$$;
create trigger notes_activity after insert on public.notes
  for each row execute function app.log_note_created();

-- A student opened a published summary.
create function app.log_summary_viewed() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (user_id, kind, course_id)
  select new.student_id, 'summary_viewed', s.course_id from public.summaries s where s.id = new.summary_id;
  return new;
end
$$;
create trigger summary_views_activity after insert on public.summary_views
  for each row execute function app.log_summary_viewed();

-- Someone signed in.
create function app.log_sign_in() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (user_id, kind) values (new.id, 'sign_in');
  return new;
end
$$;
create trigger on_auth_user_sign_in_activity after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function app.log_sign_in();

-- ---------------------------------------------------------------------------------------------
-- The six counts on the stat cards. `p_tz` is the administrator's time zone, so "this term" means
-- the days on their calendar. SECURITY: only an administrator passes the first check.
-- ---------------------------------------------------------------------------------------------

create function public.admin_overview(p_tz text)
  returns table (students integer, teachers integer, active_courses integer, classes_this_term integer,
                 published_summaries integer, active_ai_jobs integer)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_starts date;
  v_ends date;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select term_starts_on, term_ends_on into v_starts, v_ends from public.platform_settings;
  return query select
    (select count(*) from public.profiles where role = 'student')::integer,
    (select count(*) from public.profiles where role = 'teacher')::integer,
    (select count(*) from public.courses where archived_at is null)::integer,
    (select count(*) from public.class_sessions k
       where k.archived_at is null
         and (k.starts_at at time zone p_tz)::date between v_starts and v_ends)::integer,
    (select count(*) from public.summaries where status = 'published')::integer,
    (select count(*) from public.ai_jobs where status in ('queued', 'running'))::integer;
end
$$;
revoke all on function public.admin_overview(text) from public, anon, authenticated;
grant execute on function public.admin_overview(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- The alerts: one row per kind of problem with how many records have it (zero rows are sent too;
-- the app drops them). `p_now` is the moment to measure from, so a test can pin it. SECURITY: only
-- an administrator passes the first check.
-- ---------------------------------------------------------------------------------------------

create function public.admin_alerts(p_now timestamptz)
  returns table (kind text, count integer, days integer)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_days integer;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select review_alert_days into v_days from public.platform_settings;
  return query
    select 'security_events', (select count(*) from public.security_events where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    select 'ai_jobs_failed', (select count(*) from public.ai_jobs where status = 'failed' and finished_at > p_now - interval '24 hours' and finished_at <= p_now)::integer, null::integer
    union all
    select 'notifications_failed', (select count(*) from public.delivery_failures where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    select 'storage_errors', (select count(*) from public.storage_errors where created_at > p_now - interval '24 hours' and created_at <= p_now)::integer, null::integer
    union all
    select 'courses_without_teacher', (select count(*) from public.courses where archived_at is null and teacher_id is null)::integer, null::integer
    union all
    select 'classes_in_archived_courses', (select count(*) from public.class_sessions k join public.courses c on c.id = k.course_id where k.archived_at is null and c.archived_at is not null)::integer, null::integer
    union all
    select 'summaries_waiting_review', (select count(*) from public.summaries where status = 'in_review' and in_review_since is not null and in_review_since < p_now - make_interval(days => v_days))::integer, v_days
    union all
    select 'enrollment_requests_waiting', (select count(*) from public.enrollment_requests r join public.courses c on c.id = r.course_id where r.status = 'pending' and c.archived_at is null)::integer, null::integer;
end
$$;
revoke all on function public.admin_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_alerts(timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- One count per day for a series, over the days `p_from` to `p_to` (inclusive) on the
-- administrator's calendar. Days with nothing are left out; the app fills them with zero.
-- SECURITY: only an administrator passes the first check, and `p_series` is matched against a fixed
-- list, never run as SQL.
-- ---------------------------------------------------------------------------------------------

create function public.admin_activity_series(p_series text, p_from date, p_to date, p_tz text)
  returns table (day date, count integer)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_series not in ('notes_created', 'summaries_generated', 'summaries_published', 'resources_opened', 'ai_questions') then
    raise exception 'unknown series' using errcode = '22023';
  end if;
  return query
    select (t.at at time zone p_tz)::date as day, count(*)::integer
    from (
      select e.created_at as at
        from public.activity_events e
        where (p_series = 'notes_created' and e.kind = 'note_created')
           or (p_series = 'resources_opened' and e.kind = 'resource_opened')
           or (p_series = 'ai_questions' and e.kind = 'ai_question')
      union all
      select j.finished_at from public.ai_jobs j
        where p_series = 'summaries_generated' and j.status = 'succeeded' and j.finished_at is not null
      union all
      select s.published_at from public.summaries s
        where p_series = 'summaries_published' and s.published_at is not null
    ) t
    where (t.at at time zone p_tz)::date between p_from and p_to
    group by 1
    order by 1;
end
$$;
revoke all on function public.admin_activity_series(text, date, date, text) from public, anon, authenticated;
grant execute on function public.admin_activity_series(text, date, date, text) to authenticated, service_role;

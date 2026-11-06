-- Notes are written in a window, and a teacher or administrator can read them (D123).
--
-- Three changes, one reason each:
--   1. A student may write or edit a note only from the start of the class until one hour after it
--      ends. Notes written long afterwards were reaching the summary after it had been drafted
--      (BUS 101 class 4: the draft was made from 1 note and 36 more arrived after it).
--   2. The AI draft waits until that window has closed, so it always sees every note.
--   3. A teacher (for the courses they teach) and an administrator (for any course) can read notes
--      with the student's name, through two functions that record every use. This replaces D74,
--      under which teachers saw counts only. Students are told in the app.

-- ---------------------------------------------------------------------------------------------
-- 1. The writing window
-- ---------------------------------------------------------------------------------------------

-- True while notes may be written for the class: from its start until one hour after its end. It
-- reads the class itself, not through the caller's view of classes, like app.class_started.
create function app.class_open_for_notes(p_class uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.class_sessions k
     where k.id = p_class
       and k.starts_at <= now()
       and now() <= k.ends_at + interval '1 hour'
  )
$$;

-- Replaces the insert and update rules of the faster-access migration with the same ones, except
-- that the class must be open for notes and not only started.
-- SECURITY: whatever the app sends, a note cannot be filed under, or moved to, a class whose
-- window is closed. A request that skips the app meets the same rule.
drop policy notes_own_insert on public.notes;
drop policy notes_own_update on public.notes;
create policy notes_own_insert on public.notes for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and app.is_enrolled(course_id)
    and app.class_open_for_notes(class_id)
  );
create policy notes_own_update on public.notes for update to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and app.is_enrolled(course_id)
    and app.class_open_for_notes(class_id)
  );

-- ---------------------------------------------------------------------------------------------
-- 2. The draft waits for the window to close
-- ---------------------------------------------------------------------------------------------

-- The same function as before, with one change: the grace is now one hour and five minutes, the
-- notes window plus a margin, instead of fifteen minutes after the class. A class is drafted only
-- when no note can still be written for it.
create or replace function public.queue_summary_jobs(
  p_now timestamptz default now(),
  p_grace interval default interval '1 hour 5 minutes'
) returns integer
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_class record;
  v_count integer := 0;
begin
  for v_class in
    select k.id, k.course_id
    from public.class_sessions k
    join public.courses c on c.id = k.course_id
    left join public.summaries s on s.class_id = k.id
    where k.archived_at is null and c.archived_at is null
      and k.ends_at <= p_now - p_grace
      and (s.id is null or s.status = 'collecting')
      and exists (select 1 from public.notes n where n.class_id = k.id)
      and not exists (select 1 from public.ai_jobs j where j.class_id = k.id and j.kind = 'summary')
    order by k.ends_at
    limit 50
    for update of k skip locked
  loop
    insert into public.summaries (class_id, course_id, status)
      values (v_class.id, v_class.course_id, 'processing')
      on conflict (class_id) do update set status = 'processing' where public.summaries.status = 'collecting';
    insert into public.ai_jobs (class_id, course_id, kind, status, created_at)
      values (v_class.id, v_class.course_id, 'summary', 'queued', p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Reading notes
-- ---------------------------------------------------------------------------------------------

-- Notes that match a search, newest first, a page at a time. Every filter is optional.
--   p_course, p_class, p_student_id: exact.
--   p_student_text: part of a student's name, email or student number (no wildcards: it is matched
--     as plain text, so a "%" or "_" typed in the box means just that).
-- `total_count` is the number of matches, the same on every row, so a screen can show "1-50 of 37".
-- SECURITY: only an active administrator (any course) or an active teacher (the courses they teach)
-- gets rows; everyone else is refused. The table itself stays closed to them (no policy), so this
-- function is the only door, and every use is written to the audit log, without the note text.
create function public.search_notes(
  p_course uuid default null,
  p_class uuid default null,
  p_student_id uuid default null,
  p_student_text text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  note_id uuid,
  class_id uuid,
  class_number integer,
  class_title text,
  course_id uuid,
  course_code text,
  course_title text,
  student_id uuid,
  student_name text,
  student_number text,
  note_title text,
  content_html text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
  language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_admin boolean := app.is_admin();
  v_text text := lower(btrim(coalesce(p_student_text, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not v_admin and app."current_role"() is distinct from 'teacher' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_text) > 100 then
    raise exception 'search too long' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, course_id, class_id, metadata)
    values (auth.uid(), app."current_role"(), 'notes.viewed', 'notes', p_course, p_class,
            jsonb_build_object('view', 'search', 'byStudent', (p_student_id is not null or v_text <> ''), 'offset', v_offset));
  return query
    select n.id, n.class_id, k.number, k.title, n.course_id, c.code, c.title,
           n.student_id, p.full_name, p.student_number, n.title, n.content_html,
           n.created_at, n.updated_at, count(*) over ()
      from public.notes n
      join public.class_sessions k on k.id = n.class_id
      join public.courses c on c.id = n.course_id
      join public.profiles p on p.id = n.student_id
     where (v_admin or n.course_id in (select app.taught_course_ids()))
       and (p_course is null or n.course_id = p_course)
       and (p_class is null or n.class_id = p_class)
       and (p_student_id is null or n.student_id = p_student_id)
       and (v_text = ''
            or strpos(lower(p.full_name), v_text) > 0
            or strpos(lower(p.email), v_text) > 0
            or strpos(lower(coalesce(p.student_number, '')), v_text) > 0)
     order by n.created_at desc, n.id
     limit v_limit offset v_offset;
end
$$;
revoke all on function public.search_notes(uuid, uuid, uuid, text, integer, integer) from public, anon;
grant execute on function public.search_notes(uuid, uuid, uuid, text, integer, integer) to authenticated, service_role;

-- Who has written for a class and who has not: every student enrolled in its course, plus anyone
-- who wrote a note and has since left, each with how many notes they wrote. Counts only.
-- SECURITY: the same two callers as above, and a teacher only for a course they teach.
create function public.class_note_roster(p_class uuid)
  returns table (student_id uuid, student_name text, student_number text, note_count integer)
  language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_course uuid;
begin
  if not app.is_admin() and app."current_role"() is distinct from 'teacher' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select k.course_id into v_course from public.class_sessions k where k.id = p_class;
  if v_course is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not app.is_admin() and v_course not in (select app.taught_course_ids()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, course_id, class_id, metadata)
    values (auth.uid(), app."current_role"(), 'notes.viewed', 'notes', v_course, p_class,
            jsonb_build_object('view', 'roster'));
  return query
    select p.id, p.full_name, p.student_number,
           (select count(*) from public.notes n where n.class_id = p_class and n.student_id = p.id)::integer
      from public.profiles p
     where p.id in (
       select e.student_id from public.enrollments e where e.course_id = v_course
       union
       select n.student_id from public.notes n where n.class_id = p_class
     )
     order by p.full_name, p.id;
end
$$;
revoke all on function public.class_note_roster(uuid) from public, anon;
grant execute on function public.class_note_roster(uuid) to authenticated, service_role;

-- Programmes and the timetable import (D105). A programme is a group of courses that students take
-- together, such as Software Engineering Year 1. A student picks one programme and is enrolled in
-- all its courses in use at once; an administrator creates programmes, courses and classes by
-- importing the school's timetable.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- A programme. "Closed" stops students joining it themselves; it is not deleted, so its history
-- stays. The code and name limits keep what an administrator (or a timetable) writes sensible.
create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  -- Whether a student may join it from the sign-up screen.
  open_enrolment boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint programmes_code_shape check (code ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$'),
  constraint programmes_name_size check (char_length(name) between 1 and 100)
);
-- One programme per code, in any letter case ("SWE" and "swe" are the same).
create unique index programmes_code_lower on public.programmes (lower(code));

-- Which courses a programme holds. A course may be in several programmes (a first-year English
-- course is taken by every programme).
create table public.programme_courses (
  programme_id uuid not null references public.programmes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  primary key (programme_id, course_id)
);
-- Lets "which programmes hold this course" use an index.
create index programme_courses_by_course on public.programme_courses (course_id);

-- The programme a student joined. Set only by join_programme(): the column is in no grant, so a
-- student cannot write it themselves.
alter table public.profiles
  add column programme_id uuid references public.programmes (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: only administrators touch the tables. Students read programmes through the
-- view below, which shows only what they need.
-- ---------------------------------------------------------------------------------------------

alter table public.programmes enable row level security;
alter table public.programme_courses enable row level security;
-- Nothing is granted by default; then exactly what the signed-in role needs.
revoke all on public.programmes, public.programme_courses from public, anon, authenticated;
grant select, insert, update, delete on public.programmes, public.programme_courses to authenticated;
-- SECURITY: with these policies a student or teacher who calls the API directly sees no rows and
-- cannot add, change or remove any.
create policy programmes_admin_all on public.programmes for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy programme_courses_admin_all on public.programme_courses for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------------------------
-- Views. Like the other views they run with the owner's rights and filter on the caller
-- themselves, so they must not be switched to security_invoker.
-- ---------------------------------------------------------------------------------------------

-- The administrator's list: every programme with its course and student counts.
create view public.admin_programmes with (security_barrier = true) as
  select p.id, p.code, p.name, p.open_enrolment, p.archived_at, p.created_at,
         -- Every course linked, whatever its state.
         (select count(*) from public.programme_courses pc where pc.programme_id = p.id)::integer as course_count,
         -- Students who joined this programme.
         (select count(*) from public.profiles s where s.programme_id = p.id and s.role = 'student')::integer as student_count
  from public.programmes p
  where app.is_admin();
revoke all on public.admin_programmes from public, anon;
grant select on public.admin_programmes to authenticated;

-- What a student is offered: the open programmes, the codes of the courses in use they would join
-- (A to Z), and whether it is their own. Counts and codes only: no teacher or student details.
create view public.joinable_programmes with (security_barrier = true) as
  select p.id, p.code, p.name,
         (select count(*) from public.programme_courses pc join public.courses c on c.id = pc.course_id
           where pc.programme_id = p.id and c.archived_at is null and c.status <> 'completed')::integer as course_count,
         coalesce((select array_agg(c.code order by c.code) from public.programme_courses pc join public.courses c on c.id = pc.course_id
           where pc.programme_id = p.id and c.archived_at is null and c.status <> 'completed'), array[]::text[]) as course_codes,
         coalesce((select me.programme_id = p.id from public.profiles me where me.id = auth.uid()), false) as is_mine
  from public.programmes p
  where p.open_enrolment and p.archived_at is null and app.current_role() = 'student';
revoke all on public.joinable_programmes from public, anon;
grant select on public.joinable_programmes to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Joining a programme
-- ---------------------------------------------------------------------------------------------

-- A student joins an open programme: they are enrolled in each of its courses in use, and the
-- programme is remembered on their profile. Returns how many courses were newly joined; joining
-- again adds nothing. It runs as the owner, so it checks the caller itself.
-- SECURITY: only an active student passes. An unknown, closed or archived programme all answer
-- "not found", so the answer reveals nothing about which programmes exist.
create function public.join_programme(p_programme uuid) returns integer
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_added integer;
begin
  -- Only students join programmes.
  if app.current_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- It must exist, be open and be in use.
  if not exists (
    select 1 from public.programmes p
    where p.id = p_programme and p.open_enrolment and p.archived_at is null
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- Enrol in every course in use; a course the student is already in is skipped.
  insert into public.enrollments (course_id, student_id)
    select pc.course_id, auth.uid()
    from public.programme_courses pc
    join public.courses c on c.id = pc.course_id
    where pc.programme_id = p_programme and c.archived_at is null and c.status <> 'completed'
  on conflict do nothing;
  get diagnostics v_added = row_count;
  -- Remember the choice.
  update public.profiles set programme_id = p_programme where id = auth.uid();
  return v_added;
end
$$;
revoke all on function public.join_programme(uuid) from public, anon;
grant execute on function public.join_programme(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The timetable import
-- ---------------------------------------------------------------------------------------------

-- A course code in its stored form: letters upper-case, no spaces, then one space between the
-- letters and the digits ("csc101" and "CSC  101" both become "CSC 101"). The same rule as the
-- admin console's course form.
create function app.normalize_course_code(p_code text) returns text
  language sql immutable set search_path = '' as $$
  select regexp_replace(upper(regexp_replace(btrim(coalesce(p_code, '')), '\s+', '', 'g')), '^([A-Z]+)([0-9])', '\1 \2')
$$;
revoke all on function app.normalize_course_code(text) from public;

-- Creates what a timetable describes, in one transaction: programmes, courses (matched by code, any
-- letter case), the programme-to-course links, and each class. `p_payload` is:
--   { "timezone": "Africa/Douala",
--     "programmes": [{ "code", "name", "courseCodes": [...] }],
--     "courses":    [{ "code", "title", "teacherId": uuid|null,
--                      "sessions": [{ "start": "2026-10-19T08:00", "end": "...", "title" }] }] }
-- Times are local, with no offset; the time zone turns them into moments.
-- Nothing that exists is overwritten: an existing course keeps its title and teacher (a teacher is
-- filled in only where there is none), and a class that already starts at that time is skipped.
-- With p_dry_run the whole run is undone and only the counts come back.
-- SECURITY: only an administrator passes. The payload is checked for shape and size before use.
create function public.import_timetable(p_payload jsonb, p_dry_run boolean default false)
  returns jsonb
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz text;
  v_course jsonb;
  v_session jsonb;
  v_programme jsonb;
  v_code_value jsonb;
  v_code text;
  v_title text;
  v_name text;
  v_course_id uuid;
  v_existing_teacher uuid;
  v_teacher uuid;
  v_programme_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_first timestamptz;
  v_last timestamptz;
  v_status public.course_status;
  v_result jsonb;
  -- The counts the answer reports.
  n_programmes_created integer := 0;
  n_programmes_existing integer := 0;
  n_courses_created integer := 0;
  n_courses_existing integer := 0;
  n_classes_created integer := 0;
  n_classes_skipped integer := 0;
  n_teachers_assigned integer := 0;
begin
  -- Only administrators import.
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- The payload must be an object holding two lists, in a known time zone, of a sane size.
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload -> 'courses') is distinct from 'array'
     or jsonb_typeof(p_payload -> 'programmes') is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  v_tz := p_payload ->> 'timezone';
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload -> 'courses') > 200 or jsonb_array_length(p_payload -> 'programmes') > 50 then
    raise exception 'too many courses or programmes' using errcode = '22023';
  end if;

  -- Everything between here and the end runs in a sub-transaction, so a dry run can undo it all
  -- (the counts above are variables, which an undo does not reset).
  begin
    for v_course in select value from jsonb_array_elements(p_payload -> 'courses') loop
      -- The code in its stored form, which must look like SWE 311.
      v_code := app.normalize_course_code(v_course ->> 'code');
      v_title := btrim(coalesce(v_course ->> 'title', ''));
      if v_code !~ '^[A-Z]{2,5} [0-9]{3}[A-Z]?$' or v_title = '' or char_length(v_title) > 150 then
        raise exception 'a course needs a code like SWE 311 and a title' using errcode = '22023';
      end if;
      if jsonb_typeof(v_course -> 'sessions') is distinct from 'array'
         or jsonb_array_length(v_course -> 'sessions') > 500 then
        raise exception 'a course needs a list of classes' using errcode = '22023';
      end if;
      v_teacher := nullif(v_course ->> 'teacherId', '')::uuid;

      select c.id, c.teacher_id into v_course_id, v_existing_teacher
        from public.courses c where lower(c.code) = lower(v_code);
      if v_course_id is null then
        -- A new course: upcoming before its first class, completed after its last, else ongoing.
        select min((s ->> 'start')::timestamp at time zone v_tz), max((s ->> 'end')::timestamp at time zone v_tz)
          into v_first, v_last from jsonb_array_elements(v_course -> 'sessions') s;
        v_status := case
          when v_first is null or now() < v_first then 'upcoming'
          when now() > v_last then 'completed'
          else 'ongoing' end;
        insert into public.courses (code, title, teacher_id, status)
          values (v_code, v_title, v_teacher, v_status) returning id into v_course_id;
        n_courses_created := n_courses_created + 1;
        if v_teacher is not null then n_teachers_assigned := n_teachers_assigned + 1; end if;
      else
        n_courses_existing := n_courses_existing + 1;
        -- A teacher is filled in only where the course has none.
        if v_teacher is not null and v_existing_teacher is null then
          update public.courses set teacher_id = v_teacher where id = v_course_id;
          n_teachers_assigned := n_teachers_assigned + 1;
        end if;
      end if;

      -- The classes. One that already starts at the same moment is left as it is.
      for v_session in select value from jsonb_array_elements(v_course -> 'sessions') loop
        v_start := (v_session ->> 'start')::timestamp at time zone v_tz;
        v_end := (v_session ->> 'end')::timestamp at time zone v_tz;
        v_name := btrim(coalesce(v_session ->> 'title', ''));
        if v_end <= v_start or v_name = '' or char_length(v_name) > 150 then
          raise exception 'a class needs a title and must end after it starts' using errcode = '22023';
        end if;
        if exists (select 1 from public.class_sessions k where k.course_id = v_course_id and k.starts_at = v_start) then
          n_classes_skipped := n_classes_skipped + 1;
        else
          insert into public.class_sessions (course_id, title, starts_at, ends_at)
            values (v_course_id, v_name, v_start, v_end);
          n_classes_created := n_classes_created + 1;
        end if;
      end loop;
    end loop;

    -- Programmes, once their courses exist.
    for v_programme in select value from jsonb_array_elements(p_payload -> 'programmes') loop
      v_code := btrim(coalesce(v_programme ->> 'code', ''));
      v_name := btrim(coalesce(v_programme ->> 'name', ''));
      if v_code = '' or v_name = '' or jsonb_typeof(v_programme -> 'courseCodes') is distinct from 'array' then
        raise exception 'a programme needs a code, a name and a list of courses' using errcode = '22023';
      end if;
      select p.id into v_programme_id from public.programmes p where lower(p.code) = lower(v_code);
      if v_programme_id is null then
        insert into public.programmes (code, name) values (v_code, v_name) returning id into v_programme_id;
        n_programmes_created := n_programmes_created + 1;
      else
        n_programmes_existing := n_programmes_existing + 1;
      end if;
      for v_code_value in select value from jsonb_array_elements(v_programme -> 'courseCodes') loop
        select c.id into v_course_id from public.courses c
          where lower(c.code) = lower(app.normalize_course_code(v_code_value #>> '{}'));
        if v_course_id is null then
          raise exception 'a programme names a course that does not exist' using errcode = '22023';
        end if;
        insert into public.programme_courses (programme_id, course_id) values (v_programme_id, v_course_id)
          on conflict do nothing;
      end loop;
    end loop;

    -- A dry run ends here: this error undoes the sub-transaction and is caught below.
    if p_dry_run then
      raise exception 'dry run' using errcode = 'D0RUN';
    end if;
  exception when sqlstate 'D0RUN' then
    null;
  end;

  v_result := jsonb_build_object(
    'programmesCreated', n_programmes_created,
    'programmesExisting', n_programmes_existing,
    'coursesCreated', n_courses_created,
    'coursesExisting', n_courses_existing,
    'classesCreated', n_classes_created,
    'classesSkipped', n_classes_skipped,
    'teachersAssigned', n_teachers_assigned
  );
  -- A real run is recorded with its counts and nothing else.
  if not p_dry_run then
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, metadata)
      values (auth.uid(), 'admin', 'timetable.import', 'timetable', v_result);
  end if;
  return v_result;
end
$$;
revoke all on function public.import_timetable(jsonb, boolean) from public, anon;
grant execute on function public.import_timetable(jsonb, boolean) to authenticated;

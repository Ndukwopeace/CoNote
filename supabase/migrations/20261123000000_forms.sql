-- Lecturer assessments, built like a Google Form (D126). An administrator builds a form with a few
-- kinds of question, one of which is "Course and lecturer", a dropdown filled from the timetable.
-- Anyone with the form's link can answer it, without an account. Only administrators read the
-- answers. The tables are closed to every browser; the functions below are the only way in.

-- ---------------------------------------------------------------------------------------------
-- Lecturer names from the timetable
-- ---------------------------------------------------------------------------------------------

-- The lecturers a course's timetable names, as plain text. They need not be accounts on the platform.
alter table public.courses
  add column lecturers text[] not null default '{}',
  add constraint courses_lecturers_size
    check (cardinality(lecturers) <= 10 and char_length(array_to_string(lecturers, '')) <= 1000);

-- The same import as before, plus: a course's `lecturers` list in the payload is stored on it.
create or replace function public.import_timetable(p_payload jsonb, p_dry_run boolean default false)
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
  v_lecturers text[];
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
      -- The lecturer names the timetable gives for this course, kept as plain text (D126). They are
      -- names, not accounts: a lecturer need not be on the platform.
      if jsonb_typeof(coalesce(v_course -> 'lecturers', '[]'::jsonb)) is distinct from 'array'
         or jsonb_array_length(coalesce(v_course -> 'lecturers', '[]'::jsonb)) > 10 then
        raise exception 'a course has at most ten lecturers' using errcode = '22023';
      end if;
      select coalesce(array_agg(distinct btrim(x)), '{}') into v_lecturers
        from jsonb_array_elements_text(coalesce(v_course -> 'lecturers', '[]'::jsonb)) x
        where btrim(x) <> '';
      if exists (select 1 from unnest(v_lecturers) n where char_length(n) > 100) then
        raise exception 'a lecturer name is too long' using errcode = '22023';
      end if;

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

      -- The timetable is where lecturer names come from, so the names it gives replace any before.
      -- A course the timetable names nobody for keeps what it had.
      if cardinality(v_lecturers) > 0 then
        update public.courses set lecturers = v_lecturers where id = v_course_id;
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

-- ---------------------------------------------------------------------------------------------
-- The tables
-- ---------------------------------------------------------------------------------------------

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  -- The secret in the public link: 122 random bits, so a link cannot be guessed.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text not null default '' check (char_length(description) <= 2000),
  -- Whether the form takes answers now, inside its dates. A new form starts closed.
  accepting boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at is null or closes_at is null or closes_at > opens_at)
);

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  position integer not null check (position >= 0),
  -- short and paragraph: text. choice and dropdown: one of `options`. rating: 1 to 5.
  -- lecturer: a course and one of its timetable lecturers.
  kind text not null check (kind in ('short', 'paragraph', 'choice', 'dropdown', 'rating', 'lecturer')),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 300),
  required boolean not null default false,
  options text[] not null default '{}',
  -- Positions are checked at the end of a save, so questions can swap places.
  unique (form_id, position) deferrable initially deferred,
  check (
    (kind in ('choice', 'dropdown') and cardinality(options) between 2 and 20)
    or (kind not in ('choice', 'dropdown') and cardinality(options) = 0)
  )
);
-- A form has at most one "Course and lecturer" question.
create unique index form_questions_one_lecturer on public.form_questions (form_id) where kind = 'lecturer';

create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- The course and lecturer answered about, kept as text so the results survive a course changing.
  course_id uuid references public.courses (id) on delete set null,
  course_code text,
  lecturer text,
  -- Every other answer, by question ID. No name, no account, nothing that says who sent it.
  answers jsonb not null check (octet_length(answers::text) <= 60000)
);
create index form_responses_form_created_idx on public.form_responses (form_id, created_at desc);
create index form_responses_form_group_idx on public.form_responses (form_id, course_code, lecturer);

-- SECURITY: no policy and no grant, so no browser reads or changes a row directly. A visitor cannot
-- read anyone's answers or edit a form; they can only call the two public functions below.
alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_responses enable row level security;
revoke all on public.forms, public.form_questions, public.form_responses from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- 'open', 'not_open' (opens later) or 'closed', from the switch and the dates.
create function app.form_state(f public.forms) returns text
  language sql stable set search_path = public, pg_temp as $$
  select case
    when not f.accepting then 'closed'
    when f.opens_at is not null and now() < f.opens_at then 'not_open'
    when f.closes_at is not null and now() >= f.closes_at then 'closed'
    else 'open'
  end
$$;

-- Every course in use with each lecturer its timetable names, one entry per pair, in order.
create function app.lecturer_options() returns jsonb
  language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('courseId', c.id, 'courseCode', c.code, 'courseTitle', c.title, 'lecturer', l)
              order by c.code, l),
    '[]'::jsonb)
  from public.courses c
  cross join lateral unnest(c.lecturers) l
  where c.archived_at is null
$$;
revoke all on function app.lecturer_options() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The public side: read a form by its link, and send an answer
-- ---------------------------------------------------------------------------------------------

-- The form behind a link: its title, description and questions, and the lecturer choices when it
-- has a "Course and lecturer" question. A form that is not open answers with its title and state
-- only. An unknown link is "not found".
-- SECURITY: this is callable by anyone, so it returns only what the form's own page shows and never
-- an answer, a count or an administrator's detail.
create function public.public_form(p_token text) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_form public.forms%rowtype;
  v_state text;
begin
  select * into v_form from public.forms f where f.token = p_token;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_state := app.form_state(v_form);
  if v_state <> 'open' then
    return jsonb_build_object('title', v_form.title, 'description', v_form.description,
                              'state', v_state, 'questions', '[]'::jsonb, 'lecturers', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'title', v_form.title,
    'description', v_form.description,
    'state', 'open',
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt,
                                          'required', q.required, 'options', to_jsonb(q.options))
                       order by q.position)
        from public.form_questions q where q.form_id = v_form.id), '[]'::jsonb),
    'lecturers', case
      when exists (select 1 from public.form_questions q where q.form_id = v_form.id and q.kind = 'lecturer')
      then app.lecturer_options() else '[]'::jsonb end
  );
end
$$;
revoke all on function public.public_form(text) from public;
grant execute on function public.public_form(text) to anon, authenticated, service_role;

-- Stores one answer to the form behind a link. `p_answers` maps a question's ID to the answer: text,
-- a choice, a whole number from 1 to 5, or {"courseId": ..., "lecturer": ...} for the lecturer question.
-- SECURITY: anyone can call this, so every rule is checked here and not in the browser. The form must be
-- open. Only the form's own questions may be answered. Text is cut to its limit, a choice must be one
-- of the options, a rating a whole number from 1 to 5, and a lecturer one the timetable names for a
-- course in use. The size of an answer is capped, no more than 600 answers a minute are taken per form
-- (so a script cannot flood it) and 50,000 in all. Nothing about the sender is stored.
create function public.submit_form_response(p_token text, p_answers jsonb) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_form public.forms%rowtype;
  v_q record;
  v_raw jsonb;
  v_text text;
  v_num numeric;
  v_clean jsonb := '{}'::jsonb;
  v_course_id uuid;
  v_course_code text;
  v_lecturer text;
  v_limit integer;
begin
  select * into v_form from public.forms f where f.token = p_token;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if app.form_state(v_form) <> 'open' then
    raise exception 'closed' using errcode = '55000';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text) > 60000 then
    raise exception 'invalid answers' using errcode = '22023';
  end if;
  -- An answer to something the form does not ask is refused, so nothing else is stored.
  if exists (
    select 1 from jsonb_object_keys(p_answers) k
    where k not in (select q.id::text from public.form_questions q where q.form_id = v_form.id)
  ) then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  if (select count(*) from public.form_responses r
       where r.form_id = v_form.id and r.created_at > now() - interval '1 minute') >= 600
     or (select count(*) from public.form_responses r where r.form_id = v_form.id) >= 50000 then
    raise exception 'too many answers' using errcode = '54000';
  end if;

  for v_q in select * from public.form_questions q where q.form_id = v_form.id order by q.position loop
    v_raw := p_answers -> v_q.id::text;
    -- Not answered, or only spaces.
    if v_raw is null or v_raw = 'null'::jsonb
       or (jsonb_typeof(v_raw) = 'string' and btrim(v_raw #>> '{}') = '') then
      if v_q.required then
        raise exception 'an answer is required' using errcode = '22023';
      end if;
      continue;
    end if;
    case v_q.kind
      when 'short', 'paragraph' then
        if jsonb_typeof(v_raw) <> 'string' then
          raise exception 'invalid answer' using errcode = '22023';
        end if;
        v_text := btrim(v_raw #>> '{}');
        v_limit := case when v_q.kind = 'short' then 300 else 2000 end;
        if char_length(v_text) > v_limit then
          raise exception 'answer too long' using errcode = '22023';
        end if;
        v_clean := v_clean || jsonb_build_object(v_q.id::text, v_text);
      when 'choice', 'dropdown' then
        if jsonb_typeof(v_raw) <> 'string' or not ((v_raw #>> '{}') = any (v_q.options)) then
          raise exception 'invalid choice' using errcode = '22023';
        end if;
        v_clean := v_clean || jsonb_build_object(v_q.id::text, v_raw #>> '{}');
      when 'rating' then
        if jsonb_typeof(v_raw) <> 'number' then
          raise exception 'invalid rating' using errcode = '22023';
        end if;
        v_num := (v_raw #>> '{}')::numeric;
        if v_num <> trunc(v_num) or v_num not between 1 and 5 then
          raise exception 'invalid rating' using errcode = '22023';
        end if;
        v_clean := v_clean || jsonb_build_object(v_q.id::text, v_num::integer);
      when 'lecturer' then
        if jsonb_typeof(v_raw) <> 'object' then
          raise exception 'invalid lecturer' using errcode = '22023';
        end if;
        begin
          v_course_id := (v_raw ->> 'courseId')::uuid;
        exception when others then
          raise exception 'invalid lecturer' using errcode = '22023';
        end;
        v_lecturer := v_raw ->> 'lecturer';
        select c.code into v_course_code from public.courses c
         where c.id = v_course_id and c.archived_at is null and v_lecturer = any (c.lecturers);
        if v_course_code is null then
          raise exception 'invalid lecturer' using errcode = '22023';
        end if;
    end case;
  end loop;

  insert into public.form_responses (form_id, course_id, course_code, lecturer, answers)
    values (v_form.id, v_course_id, v_course_code, v_lecturer, v_clean);
end
$$;
revoke all on function public.submit_form_response(text, jsonb) from public;
grant execute on function public.submit_form_response(text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- The administrator's side
-- ---------------------------------------------------------------------------------------------

-- Every form with its state and how many answers it has, newest first.
-- SECURITY: administrators only.
create function public.admin_list_forms()
  returns table (
    id uuid, token text, title text, accepting boolean, opens_at timestamptz, closes_at timestamptz,
    created_at timestamptz, state text, question_count bigint, response_count bigint
  )
  language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select f.id, f.token, f.title, f.accepting, f.opens_at, f.closes_at, f.created_at,
           app.form_state(f),
           (select count(*) from public.form_questions q where q.form_id = f.id),
           (select count(*) from public.form_responses r where r.form_id = f.id)
      from public.forms f
     order by f.created_at desc, f.id;
end
$$;
revoke all on function public.admin_list_forms() from public, anon;
grant execute on function public.admin_list_forms() to authenticated, service_role;

-- One form with its questions, how many answers it has, and the lecturer choices for a preview.
-- SECURITY: administrators only.
create function public.admin_get_form(p_id uuid) returns jsonb
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_form public.forms%rowtype;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_form from public.forms f where f.id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_form.id, 'token', v_form.token, 'title', v_form.title, 'description', v_form.description,
    'accepting', v_form.accepting, 'opensAt', v_form.opens_at, 'closesAt', v_form.closes_at,
    'state', app.form_state(v_form),
    'responseCount', (select count(*) from public.form_responses r where r.form_id = v_form.id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt,
                                          'required', q.required, 'options', to_jsonb(q.options))
                       order by q.position)
        from public.form_questions q where q.form_id = v_form.id), '[]'::jsonb),
    'lecturers', app.lecturer_options()
  );
end
$$;
revoke all on function public.admin_get_form(uuid) from public, anon;
grant execute on function public.admin_get_form(uuid) to authenticated, service_role;

-- Creates a form (no `id`) or changes one, with all its questions, and returns its ID. A question with an
-- `id` is changed; one without is added; one left out is removed. Once a form has answers nothing may be
-- removed and an answered question keeps its kind and choices, so the results stay whole.
-- SECURITY: administrators only. Every limit is checked here.
create function public.admin_save_form(p_form jsonb) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_form ->> 'title', ''));
  v_description text := btrim(coalesce(p_form ->> 'description', ''));
  v_questions jsonb := coalesce(p_form -> 'questions', '[]'::jsonb);
  v_accepting boolean := coalesce((p_form ->> 'accepting')::boolean, false);
  v_opens timestamptz := nullif(p_form ->> 'opensAt', '')::timestamptz;
  v_closes timestamptz := nullif(p_form ->> 'closesAt', '')::timestamptz;
  v_has_responses boolean := false;
  v_q jsonb;
  v_pos integer := 0;
  v_qid uuid;
  v_kind text;
  v_prompt text;
  v_options text[];
  v_existing public.form_questions%rowtype;
  v_lecturers integer := 0;
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_title) not between 1 and 150 or char_length(v_description) > 2000 then
    raise exception 'a form needs a title of up to 150 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_questions) is distinct from 'array' or jsonb_array_length(v_questions) > 40 then
    raise exception 'a form has at most 40 questions' using errcode = '22023';
  end if;
  if v_opens is not null and v_closes is not null and v_closes <= v_opens then
    raise exception 'a form must close after it opens' using errcode = '22023';
  end if;
  v_id := nullif(p_form ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.forms (title, description, accepting, opens_at, closes_at, created_by)
      values (v_title, v_description, v_accepting, v_opens, v_closes, auth.uid())
      returning id into v_id;
  else
    update public.forms
       set title = v_title, description = v_description, accepting = v_accepting,
           opens_at = v_opens, closes_at = v_closes, updated_at = now()
     where id = v_id;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    v_has_responses := exists (select 1 from public.form_responses r where r.form_id = v_id);
    -- With answers on file, no question may go.
    if v_has_responses and exists (
      select 1 from public.form_questions q
       where q.form_id = v_id
         and q.id::text not in (select coalesce(e ->> 'id', '') from jsonb_array_elements(v_questions) e)
    ) then
      raise exception 'a question with answers cannot be removed' using errcode = '22023';
    end if;
    delete from public.form_questions q
     where q.form_id = v_id
       and q.id::text not in (select coalesce(e ->> 'id', '') from jsonb_array_elements(v_questions) e);
  end if;

  for v_q in select value from jsonb_array_elements(v_questions) loop
    v_kind := v_q ->> 'kind';
    v_prompt := btrim(coalesce(v_q ->> 'prompt', ''));
    if v_kind is null or v_kind not in ('short', 'paragraph', 'choice', 'dropdown', 'rating', 'lecturer') then
      raise exception 'unknown kind of question' using errcode = '22023';
    end if;
    if char_length(v_prompt) not between 1 and 300 then
      raise exception 'a question needs text of up to 300 characters' using errcode = '22023';
    end if;
    -- Choices only for the two kinds that have them.
    if v_kind in ('choice', 'dropdown') then
      v_options := coalesce(array(
        select btrim(o) from jsonb_array_elements_text(coalesce(v_q -> 'options', '[]'::jsonb)) o
         where btrim(o) <> ''), '{}');
      if cardinality(v_options) not between 2 and 20
         or exists (select 1 from unnest(v_options) o where char_length(o) > 100)
         or (select count(distinct o) from unnest(v_options) o) <> cardinality(v_options) then
        raise exception 'a choice question needs 2 to 20 different choices' using errcode = '22023';
      end if;
    else
      v_options := '{}';
    end if;
    if v_kind = 'lecturer' then
      v_lecturers := v_lecturers + 1;
      if v_lecturers > 1 then
        raise exception 'a form has at most one course and lecturer question' using errcode = '22023';
      end if;
    end if;
    v_qid := nullif(v_q ->> 'id', '')::uuid;
    if v_qid is not null then
      select * into v_existing from public.form_questions q where q.id = v_qid and q.form_id = v_id;
      if not found then
        raise exception 'unknown question' using errcode = '22023';
      end if;
      if v_has_responses and (v_existing.kind <> v_kind or v_existing.options <> v_options) then
        raise exception 'an answered question keeps its kind and choices' using errcode = '22023';
      end if;
      update public.form_questions
         set position = v_pos, kind = v_kind, prompt = v_prompt,
             required = coalesce((v_q ->> 'required')::boolean, false), options = v_options
       where id = v_qid;
    else
      insert into public.form_questions (form_id, position, kind, prompt, required, options)
        values (v_id, v_pos, v_kind, v_prompt, coalesce((v_q ->> 'required')::boolean, false), v_options);
    end if;
    v_pos := v_pos + 1;
  end loop;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'admin', 'form.saved', 'form', v_id::text,
            jsonb_build_object('questions', v_pos, 'accepting', v_accepting));
  return v_id;
end
$$;
revoke all on function public.admin_save_form(jsonb) from public, anon;
grant execute on function public.admin_save_form(jsonb) to authenticated, service_role;

-- Deletes a form with its questions and answers.
-- SECURITY: administrators only.
create function public.admin_delete_form(p_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.forms where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id)
    values (auth.uid(), 'admin', 'form.deleted', 'form', p_id::text);
end
$$;
revoke all on function public.admin_delete_form(uuid) from public, anon;
grant execute on function public.admin_delete_form(uuid) to authenticated, service_role;

-- The results by course and lecturer: how many answers, and the average of each rating question.
-- A form with no lecturer question has one row with no course and no lecturer.
-- SECURITY: administrators only.
create function public.admin_form_summary(p_id uuid)
  returns table (course_code text, lecturer text, responses bigint, averages jsonb)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.forms f where f.id = p_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return query
    select r.course_code, r.lecturer, count(*)::bigint,
           coalesce((
             select jsonb_object_agg(q.id::text, v.a)
               from public.form_questions q
               cross join lateral (
                 select round(avg((x.answers ->> q.id::text)::numeric), 2) as a
                   from public.form_responses x
                  where x.form_id = p_id
                    and x.course_code is not distinct from r.course_code
                    and x.lecturer is not distinct from r.lecturer
               ) v
              where q.form_id = p_id and q.kind = 'rating' and v.a is not null
           ), '{}'::jsonb)
      from public.form_responses r
     where r.form_id = p_id
     group by r.course_code, r.lecturer
     order by r.course_code nulls first, r.lecturer nulls first;
end
$$;
revoke all on function public.admin_form_summary(uuid) from public, anon;
grant execute on function public.admin_form_summary(uuid) to authenticated, service_role;

-- One page of the answers, newest first, optionally for one course and lecturer.
-- SECURITY: administrators only.
create function public.admin_form_responses(
  p_id uuid,
  p_course text default null,
  p_lecturer text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid, created_at timestamptz, course_code text, lecturer text, answers jsonb, total_count bigint
)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.id, r.created_at, r.course_code, r.lecturer, r.answers, count(*) over ()
      from public.form_responses r
     where r.form_id = p_id
       and (p_course is null or r.course_code = p_course)
       and (p_lecturer is null or r.lecturer = p_lecturer)
     order by r.created_at desc, r.id
     limit v_limit offset v_offset;
end
$$;
revoke all on function public.admin_form_responses(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.admin_form_responses(uuid, text, text, integer, integer) to authenticated, service_role;

-- Deletes one answer, for example one that looks like spam.
-- SECURITY: administrators only.
create function public.admin_delete_form_response(p_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.form_responses where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id)
    values (auth.uid(), 'admin', 'form.response_deleted', 'form_response', p_id::text);
end
$$;
revoke all on function public.admin_delete_form_response(uuid) from public, anon;
grant execute on function public.admin_delete_form_response(uuid) to authenticated, service_role;

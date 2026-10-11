-- What the teacher portal's review screens need from the database (milestone B3.2, D89): one list
-- of the summaries a teacher can review, and two functions that save a draft and publish it. Every
-- change to a draft now goes through a function, which checks the caller, the stage, the version
-- and the draft's shape, so the browser cannot skip any of them.

-- ---------------------------------------------------------------------------------------------
-- The review list: each summary of the teacher's own live courses, with the class and course it
-- belongs to. Like the other views it runs with the owner's rights, so it filters on the caller
-- itself. SECURITY: `app.teaches` is true only for the signed-in teacher of a course that is not
-- archived, so another teacher, a student, an administrator or a visitor gets no row.
-- ---------------------------------------------------------------------------------------------

create view public.teacher_reviews with (security_barrier = true) as
  select s.id as summary_id, c.id as course_id, c.code as course_code, c.title as course_title,
         k.number as class_number, k.title as class_title,
         s.status, s.version, s.overview, s.key_concepts, s.confusion_areas, s.key_topics,
         s.notes_analyzed_count, s.students_analyzed_count,
         s.in_review_since, s.published_at, r.full_name as reviewed_by_name
  from public.summaries s
  join public.class_sessions k on k.id = s.class_id
  join public.courses c on c.id = s.course_id
  left join public.profiles r on r.id = s.reviewed_by
  where k.archived_at is null and app.teaches(s.course_id);
revoke all on public.teacher_reviews from public, anon;
grant select on public.teacher_reviews to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A draft's lists. Checks the shape the review form enforces (at most 30 items; each with an id, a
-- required heading of at most 200 characters, and a body of at most 2000, required unless said
-- otherwise) and rebuilds each item from the known keys only, trimmed, so nothing else is stored.
-- ---------------------------------------------------------------------------------------------

create function app.clean_draft_items(p_items jsonb, p_heading text, p_body text, p_body_required boolean)
  returns jsonb
  language plpgsql immutable set search_path = public, pg_temp as $$
declare
  v_item jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_heading text;
  v_body text;
begin
  -- A list, and not too long.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid draft list' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Each item is an object whose fields are text.
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'id') is distinct from 'string'
       or jsonb_typeof(v_item -> p_heading) is distinct from 'string'
       or jsonb_typeof(v_item -> p_body) is distinct from 'string' then
      raise exception 'invalid draft item' using errcode = '22023';
    end if;
    v_heading := btrim(v_item ->> p_heading);
    v_body := btrim(v_item ->> p_body);
    if (v_item ->> 'id') = '' or v_heading = '' or length(v_heading) > 200
       or length(v_body) > 2000 or (p_body_required and v_body = '') then
      raise exception 'invalid draft item' using errcode = '22023';
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object('id', v_item ->> 'id', p_heading, v_heading, p_body, v_body));
  end loop;
  return v_clean;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Saving and publishing. Both lock the summary while it is checked and changed, and give the same
-- answers as `publish_summary`: not found (P0002) for an unknown summary, another teacher's or one
-- in an archived class; not in review (23514); a stale version (40001). A draft that breaks the
-- form's rules is refused (22023). Publishing saves the text and publishes in one statement, so a
-- draft cannot be published unsaved, and the version rises once.
-- ---------------------------------------------------------------------------------------------

create function app.write_draft(
  p_summary uuid, p_version integer, p_overview text,
  p_key_concepts jsonb, p_confusion_areas jsonb, p_key_topics jsonb, p_publish boolean)
  returns public.summaries
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_summary public.summaries;
  v_overview text := btrim(coalesce(p_overview, ''));
begin
  -- Lock the summary while it is checked and changed.
  select s.* into v_summary from public.summaries s
    join public.class_sessions k on k.id = s.class_id
    where s.id = p_summary and k.archived_at is null for update of s;
  -- Unknown, archived, or not this teacher's course: the same answer, so existence is not revealed.
  if not found or not app.teaches(v_summary.course_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- Only a draft in review can change.
  if v_summary.status <> 'in_review' then
    raise exception 'not in review' using errcode = '23514';
  end if;
  -- A stale copy is refused.
  if v_summary.version <> p_version then
    raise exception 'draft changed' using errcode = '40001';
  end if;
  -- The draft's shape.
  if v_overview = '' or length(v_overview) > 4000 then
    raise exception 'invalid overview' using errcode = '22023';
  end if;
  update public.summaries set
      overview = v_overview,
      key_concepts = app.clean_draft_items(p_key_concepts, 'title', 'explanation', true),
      confusion_areas = app.clean_draft_items(p_confusion_areas, 'issue', 'clarification', true),
      key_topics = app.clean_draft_items(p_key_topics, 'name', 'description', false),
      status = case when p_publish then 'published' else status end,
      reviewed_by = case when p_publish then auth.uid() else reviewed_by end,
      published_at = case when p_publish then now() else published_at end
    where id = p_summary
    returning * into v_summary;
  return v_summary;
end
$$;

create function public.save_summary_draft(
  p_summary uuid, p_version integer, p_overview text,
  p_key_concepts jsonb, p_confusion_areas jsonb, p_key_topics jsonb)
  returns public.summaries
  language sql security definer set search_path = public, pg_temp as $$
  select * from app.write_draft(p_summary, p_version, p_overview, p_key_concepts, p_confusion_areas, p_key_topics, false)
$$;

create function public.publish_summary_draft(
  p_summary uuid, p_version integer, p_overview text,
  p_key_concepts jsonb, p_confusion_areas jsonb, p_key_topics jsonb)
  returns public.summaries
  language sql security definer set search_path = public, pg_temp as $$
  select * from app.write_draft(p_summary, p_version, p_overview, p_key_concepts, p_confusion_areas, p_key_topics, true)
$$;

revoke all on function app.clean_draft_items(jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function app.write_draft(uuid, integer, text, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.save_summary_draft(uuid, integer, text, jsonb, jsonb, jsonb),
  public.publish_summary_draft(uuid, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_summary_draft(uuid, integer, text, jsonb, jsonb, jsonb),
  public.publish_summary_draft(uuid, integer, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- No direct edits. A teacher used to update the draft's columns through the API, which skipped
-- the draft's rules. SECURITY: that path is closed, so every edit meets the checks above.
-- ---------------------------------------------------------------------------------------------

revoke update (overview, key_concepts, confusion_areas, key_topics) on public.summaries from authenticated;
drop policy summaries_update_teacher on public.summaries;

-- The summary pipeline's database half (milestone B3.3, D90). Four functions let the pipeline's
-- worker (an Edge Function using the server key) do its whole job without ever holding more
-- power than it needs: queue a job for each class that has ended, claim the next job, store the
-- draft it wrote, or record why it failed. Nobody else can call them: a browser, signed in as
-- anyone, is refused.

-- ---------------------------------------------------------------------------------------------
-- One open job per class. A job that is queued or running blocks a second one, so two runs of the
-- worker at once can never write the same summary twice.
-- ---------------------------------------------------------------------------------------------

create unique index ai_jobs_one_open_per_class on public.ai_jobs (class_id, kind)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------------------------
-- Queue a job for each class that has ended. A class qualifies when it ended at least `p_grace`
-- ago (students may still be finishing their notes), it and its course are in use, at least one
-- student wrote a note, and the pipeline has not been run for it. Each gets a summary in
-- "processing" and a queued job. Returns how many were queued.
-- ---------------------------------------------------------------------------------------------

create function public.queue_summary_jobs(p_now timestamptz default now(), p_grace interval default interval '15 minutes')
  returns integer
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
      -- A summary exists only once the pipeline (or nobody yet) has started it.
      and (s.id is null or s.status = 'collecting')
      and exists (select 1 from public.notes n where n.class_id = k.id)
      and not exists (select 1 from public.ai_jobs j where j.class_id = k.id and j.kind = 'summary')
    order by k.ends_at
    -- A burst of classes (the first run after a long pause) is handled over several runs.
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
-- Claim the next queued job. A job that has been "running" for more than ten minutes was
-- abandoned (the worker stopped): it counts as one failed attempt, and goes back in the queue
-- unless it is out of attempts. Returns nothing when there is no work.
-- ---------------------------------------------------------------------------------------------

create function public.claim_ai_job(p_now timestamptz default now(), p_max_attempts integer default 3)
  returns table (job_id uuid, class_id uuid, course_id uuid, attempt integer, class_title text, course_title text)
  language plpgsql security definer set search_path = public, pg_temp as $$
-- The output columns share names with the table's; a bare name means the table's column.
#variable_conflict use_column
declare
  v_job public.ai_jobs;
begin
  -- Abandoned jobs with attempts left go back to the queue.
  update public.ai_jobs set status = 'queued', attempt = attempt + 1, started_at = null,
      error_code = 'timeout', error_message = 'The job took too long and was started again.'
    where status = 'running' and started_at < p_now - interval '10 minutes' and attempt < p_max_attempts;
  -- Abandoned jobs out of attempts are failed.
  update public.ai_jobs set status = 'failed', finished_at = p_now,
      error_code = 'timeout', error_message = 'The job took too long.'
    where status = 'running' and started_at < p_now - interval '10 minutes' and attempt >= p_max_attempts;
  -- The oldest queued job; another worker running at the same moment skips past it.
  select * into v_job from public.ai_jobs
    where status = 'queued' order by created_at, id limit 1 for update skip locked;
  if not found then
    return;
  end if;
  update public.ai_jobs set status = 'running', started_at = p_now where id = v_job.id;
  return query
    select v_job.id, v_job.class_id, v_job.course_id, v_job.attempt, k.title, c.title
    from public.class_sessions k join public.courses c on c.id = k.course_id
    where k.id = v_job.class_id;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Store the draft a running job wrote. The text is checked the way the review form checks it
-- (the same helper), the counts come from the notes themselves rather than from the worker, and
-- the summary moves to "in_review", where the class's teacher finds it. Only a running job on a
-- summary that is still processing can finish; anything else is refused.
-- ---------------------------------------------------------------------------------------------

create function public.finish_ai_job(
  p_job uuid, p_overview text, p_key_concepts jsonb, p_confusion_areas jsonb, p_key_topics jsonb,
  p_now timestamptz default now())
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_job public.ai_jobs;
  v_overview text := btrim(coalesce(p_overview, ''));
  v_notes integer;
  v_students integer;
begin
  select * into v_job from public.ai_jobs where id = p_job for update;
  if not found or v_job.status <> 'running' then
    raise exception 'job is not running' using errcode = '23514';
  end if;
  if v_overview = '' or length(v_overview) > 4000 then
    raise exception 'invalid overview' using errcode = '22023';
  end if;
  select count(*), count(distinct n.student_id) into v_notes, v_students
    from public.notes n where n.class_id = v_job.class_id;
  update public.summaries set
      overview = v_overview,
      key_concepts = app.clean_draft_items(p_key_concepts, 'title', 'explanation', true),
      confusion_areas = app.clean_draft_items(p_confusion_areas, 'issue', 'clarification', true),
      key_topics = app.clean_draft_items(p_key_topics, 'name', 'description', false),
      notes_analyzed_count = v_notes,
      students_analyzed_count = v_students,
      status = 'in_review',
      in_review_since = p_now
    where class_id = v_job.class_id and status = 'processing';
  if not found then
    raise exception 'summary is not processing' using errcode = '23514';
  end if;
  update public.ai_jobs set status = 'succeeded', finished_at = p_now, error_code = null, error_message = null
    where id = p_job;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Record a failed attempt. With attempts left the job goes back in the queue to try again; out of
-- attempts it is failed for good and stays on record for an administrator (B4 lists and retries
-- them). The summary stays "processing" either way: the apps know four stages, and the failure
-- is the job's, not the summary's. `p_message` must be safe text: never a note, never a trace.
-- ---------------------------------------------------------------------------------------------

create function public.fail_ai_job(
  p_job uuid, p_code text, p_message text, p_max_attempts integer default 3, p_now timestamptz default now())
  returns text
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_job public.ai_jobs;
  v_message text := left(coalesce(p_message, ''), 200);
begin
  select * into v_job from public.ai_jobs where id = p_job for update;
  if not found or v_job.status <> 'running' then
    raise exception 'job is not running' using errcode = '23514';
  end if;
  if v_job.attempt < p_max_attempts then
    update public.ai_jobs set status = 'queued', attempt = attempt + 1, started_at = null,
        error_code = left(p_code, 50), error_message = v_message
      where id = p_job;
    return 'queued';
  end if;
  update public.ai_jobs set status = 'failed', finished_at = p_now,
      error_code = left(p_code, 50), error_message = v_message
    where id = p_job;
  return 'failed';
end
$$;

-- Only the server key may call them. SECURITY: a browser, however signed in, is refused, so no
-- one can queue, claim, finish or fail a job, or write a summary, from outside.
revoke all on function public.queue_summary_jobs(timestamptz, interval),
  public.claim_ai_job(timestamptz, integer),
  public.finish_ai_job(uuid, text, jsonb, jsonb, jsonb, timestamptz),
  public.fail_ai_job(uuid, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.queue_summary_jobs(timestamptz, interval),
  public.claim_ai_job(timestamptz, integer),
  public.finish_ai_job(uuid, text, jsonb, jsonb, jsonb, timestamptz),
  public.fail_ai_job(uuid, text, text, integer, timestamptz) to service_role;

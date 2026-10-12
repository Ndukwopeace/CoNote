-- Spaced retries for the summary pipeline (D95). A failed attempt used to go straight back in the
-- queue, so all three attempts were spent inside one run, seconds apart: a model that was busy for
-- a minute failed the job for good, and a refused key was asked three times. Now a retryable
-- failure waits (two minutes, then four) before the job can be claimed again, and a failure that
-- trying again cannot fix ends the job at once.

-- When a queued job may next be claimed. Empty means now.
alter table public.ai_jobs add column retry_after timestamptz;

-- ---------------------------------------------------------------------------------------------
-- Claim the next job that is due. A queued job whose wait is not over is skipped. An abandoned job
-- (running for more than ten minutes) still counts as one failed attempt, with no wait.
-- ---------------------------------------------------------------------------------------------

create or replace function public.claim_ai_job(p_now timestamptz default now(), p_max_attempts integer default 3)
  returns table (job_id uuid, class_id uuid, course_id uuid, attempt integer, class_title text, course_title text)
  language plpgsql security definer set search_path = public, pg_temp as $$
-- The output columns share names with the table's; a bare name means the table's column.
#variable_conflict use_column
declare
  v_job public.ai_jobs;
begin
  -- Abandoned jobs with attempts left go back to the queue, due at once.
  update public.ai_jobs set status = 'queued', attempt = attempt + 1, started_at = null, retry_after = null,
      error_code = 'timeout', error_message = 'The job took too long and was started again.'
    where status = 'running' and started_at < p_now - interval '10 minutes' and attempt < p_max_attempts;
  -- Abandoned jobs out of attempts are failed.
  update public.ai_jobs set status = 'failed', finished_at = p_now, retry_after = null,
      error_code = 'timeout', error_message = 'The job took too long.'
    where status = 'running' and started_at < p_now - interval '10 minutes' and attempt >= p_max_attempts;
  -- The oldest queued job that is due; another worker running at the same moment skips past it.
  select * into v_job from public.ai_jobs
    where status = 'queued' and (retry_after is null or retry_after <= p_now)
    order by created_at, id limit 1 for update skip locked;
  if not found then
    return;
  end if;
  update public.ai_jobs set status = 'running', started_at = p_now, retry_after = null where id = v_job.id;
  return query
    select v_job.id, v_job.class_id, v_job.course_id, v_job.attempt, k.title, c.title
    from public.class_sessions k join public.courses c on c.id = k.course_id
    where k.id = v_job.class_id;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Record a failed attempt. A failure that trying again cannot fix (a refused key, a model the
-- service does not know, a class with no usable notes) fails the job at once. Any other failure
-- with attempts left puts it back in the queue to wait: two minutes after the first attempt, four
-- after the second. Out of attempts it is failed for good and stays on record for an
-- administrator (B4 lists and retries them). The summary stays "processing" either way. `p_message`
-- must be safe text: never a note, never a trace.
-- ---------------------------------------------------------------------------------------------

create or replace function public.fail_ai_job(
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
  if v_job.attempt < p_max_attempts and p_code not in ('model_key', 'model_rejected', 'no_notes') then
    update public.ai_jobs set status = 'queued', attempt = attempt + 1, started_at = null,
        retry_after = p_now + v_job.attempt * interval '2 minutes',
        error_code = left(p_code, 50), error_message = v_message
      where id = p_job;
    return 'queued';
  end if;
  update public.ai_jobs set status = 'failed', finished_at = p_now, retry_after = null,
      error_code = left(p_code, 50), error_message = v_message
    where id = p_job;
  return 'failed';
end
$$;

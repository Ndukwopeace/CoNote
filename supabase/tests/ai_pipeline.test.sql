-- The summary pipeline's database half (D90): queueing, claiming, finishing and failing jobs.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''
\set k9 '''00000000-0000-0000-0000-00000000d009'''
\set k10 '''00000000-0000-0000-0000-00000000d010'''
\set k11 '''00000000-0000-0000-0000-00000000d011'''
\set k12 '''00000000-0000-0000-0000-00000000d012'''
\set k13 '''00000000-0000-0000-0000-00000000d013'''
\set k14 '''00000000-0000-0000-0000-00000000d014'''

-- Classes that ended: K9 qualifies; K10 has no notes; K11 ended too recently; K12 is archived;
-- K13 is in an archived course (C3); K14 is the one a later test finishes.
select tests.server();
insert into public.class_sessions (id, course_id, title, starts_at, ends_at, archived_at) values
  (:k9, :c1, 'Eigenvalues', now() - interval '3 hours', now() - interval '2 hours', null),
  (:k10, :c1, 'No notes', now() - interval '3 hours', now() - interval '2 hours', null),
  (:k11, :c1, 'Just ended', now() - interval '1 hour', now() - interval '5 minutes', null),
  (:k12, :c1, 'Archived', now() - interval '3 hours', now() - interval '2 hours', now()),
  (:k13, :c3, 'Old course', now() - interval '3 hours', now() - interval '2 hours', null),
  (:k14, :c1, 'Second', now() - interval '3 hours', now() - interval '2 hours', null);
insert into public.notes (student_id, course_id, class_id, title, content_html)
  select (:s1)::uuid, c::uuid, k::uuid, 'n', '<p>text</p>' from (values (:c1, :k9), (:c1, :k11), (:c1, :k12), (:c3, :k13), (:c1, :k14)) v (c, k);
select tests.reset();

-- ===== Nobody but the server may run the pipeline's functions =====
select tests.login(:t1);
select tests.denied('select public.queue_summary_jobs()', 'a teacher cannot queue jobs');
select tests.denied('select * from public.claim_ai_job()', 'a teacher cannot claim a job');
select tests.reset();
select tests.login(:admin);
select tests.denied('select public.queue_summary_jobs()', 'an administrator cannot queue jobs');
select tests.reset();
select tests.login(:s1);
select tests.denied('select public.queue_summary_jobs()', 'a student cannot queue jobs');
select tests.denied('select public.fail_ai_job(gen_random_uuid(), ''x'', ''x'')', 'a student cannot fail a job');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.queue_summary_jobs()', 'a visitor cannot queue jobs');
select tests.reset();

-- ===== Queueing =====
select tests.server();
select tests.is(public.queue_summary_jobs(), 2, 'only the two classes that ended, have notes and are in use are queued');
select tests.is(public.queue_summary_jobs(), 0, 'queueing again queues nothing');
select tests.is((select status::text from public.summaries where class_id = :k9), 'processing', 'the summary starts in processing');
select tests.is((select status::text from public.ai_jobs where class_id = :k9), 'queued', 'and the job is queued');
select tests.is((select count(*) from public.ai_jobs where class_id in (:k10, :k11, :k12, :k13)), 0::bigint, 'classes without notes, too recent, archived or in an archived course are skipped');
select tests.fails_with('insert into public.ai_jobs (class_id, course_id, kind, status) values (' || quote_literal(:k9) || ', ' || quote_literal(:c1) || ', ''summary'', ''queued'')', '23505', 'a second open job for a class is refused');

-- ===== Claiming, and retrying a failure =====
-- Both jobs were queued in one transaction; make K9's the older.
update public.ai_jobs set created_at = now() - interval '1 hour' where class_id = :k9;
select tests.is((select class_title from public.claim_ai_job()), 'Eigenvalues', 'the oldest queued job is claimed, with its class title');
select tests.is((select status::text from public.ai_jobs where class_id = :k9), 'running', 'it is running');
select tests.is((select attempt from public.ai_jobs where class_id = :k9), 1, 'on its first attempt');
select tests.is((select public.fail_ai_job(j.id, 'groq_error', 'The language model did not answer.') from public.ai_jobs j where j.class_id = :k9), 'queued', 'a first failure queues it again');
select tests.is((select attempt from public.ai_jobs where class_id = :k9), 2, 'on its second attempt');
select tests.is((select error_code from public.ai_jobs where class_id = :k9), 'groq_error', 'the reason is kept');
select tests.is((select retry_after > now() + interval '119 seconds' and retry_after <= now() + interval '121 seconds' from public.ai_jobs where class_id = :k9), true, 'the retry waits two minutes');
-- While K9 waits, the next job is claimed instead; and with nothing else due, nothing is claimed.
select tests.is((select class_title from public.claim_ai_job(now() + interval '1 minute')), 'Second', 'a job waiting to retry is skipped while it waits');
select tests.rows('select * from public.claim_ai_job(now() + interval ''1 minute'')', 0, 'and nothing is claimed while the only queued job is still waiting');
select tests.is((select class_title from public.claim_ai_job(now() + interval '3 minutes')), 'Eigenvalues', 'once the wait is over the retry is claimed');
select tests.is((select public.fail_ai_job(j.id, 'groq_error', 'again') from public.ai_jobs j where j.class_id = :k9), 'queued', 'a second failure queues it again');
select tests.is((select retry_after > now() + interval '239 seconds' and retry_after <= now() + interval '241 seconds' from public.ai_jobs where class_id = :k9), true, 'and waits four minutes this time');
select tests.is((select class_title from public.claim_ai_job(now() + interval '5 minutes')), 'Eigenvalues', 'the third attempt is claimed');
select tests.is((select public.fail_ai_job(j.id, 'groq_error', repeat('x', 500)) from public.ai_jobs j where j.class_id = :k9), 'failed', 'the third failure is final');
select tests.is((select status::text from public.ai_jobs where class_id = :k9), 'failed', 'the job is failed');
select tests.is((select length(error_message) from public.ai_jobs where class_id = :k9), 200, 'a long message is cut to 200 characters');
select tests.is((select finished_at is not null from public.ai_jobs where class_id = :k9), true, 'it has a finish time');
select tests.is((select status::text from public.summaries where class_id = :k9), 'processing', 'the summary stays in processing');
select tests.fails_with('select public.fail_ai_job(j.id, ''x'', ''x'') from public.ai_jobs j where j.class_id = ' || quote_literal(:k9), '23514', 'a job that is not running cannot be failed again');
select tests.is((select status::text from public.ai_jobs where class_id = :k14), 'running', 'the other job was claimed while K9 waited');

-- ===== A failure that trying again cannot fix =====
-- A refused key, a model that does not exist, and a class with no usable notes fail at once, on
-- their first attempt: waiting would only repeat the same refusal.
insert into public.class_sessions (id, course_id, title, starts_at, ends_at) values
  ('00000000-0000-0000-0000-00000000d031', :c1, 'Key', now() - interval '3 hours', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d032', :c1, 'Model', now() - interval '3 hours', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d033', :c1, 'Empty', now() - interval '3 hours', now() - interval '2 hours');
insert into public.summaries (class_id, course_id, status) values
  ('00000000-0000-0000-0000-00000000d031', :c1, 'processing'),
  ('00000000-0000-0000-0000-00000000d032', :c1, 'processing'),
  ('00000000-0000-0000-0000-00000000d033', :c1, 'processing');
insert into public.ai_jobs (class_id, course_id, kind, status, created_at) values
  ('00000000-0000-0000-0000-00000000d031', :c1, 'summary', 'queued', now() - interval '50 minutes'),
  ('00000000-0000-0000-0000-00000000d032', :c1, 'summary', 'queued', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-00000000d033', :c1, 'summary', 'queued', now() - interval '30 minutes');
select tests.is((select class_title from public.claim_ai_job()), 'Key', 'the first of the three is claimed');
select tests.is((select public.fail_ai_job(j.id, 'model_key', 'The language model refused the key.') from public.ai_jobs j where j.class_id = '00000000-0000-0000-0000-00000000d031'), 'failed', 'a refused key fails at once');
select tests.is((select attempt from public.ai_jobs where class_id = '00000000-0000-0000-0000-00000000d031'), 1, 'on its first attempt');
select tests.is((select retry_after is null from public.ai_jobs where class_id = '00000000-0000-0000-0000-00000000d031'), true, 'with no retry planned');
select tests.is((select class_title from public.claim_ai_job()), 'Model', 'the next is claimed');
select tests.is((select public.fail_ai_job(j.id, 'model_rejected', 'The language model returned an error (404).') from public.ai_jobs j where j.class_id = '00000000-0000-0000-0000-00000000d032'), 'failed', 'a model the service does not know fails at once');
select tests.is((select class_title from public.claim_ai_job()), 'Empty', 'and the last');
select tests.is((select public.fail_ai_job(j.id, 'no_notes', 'The class has no notes with text.') from public.ai_jobs j where j.class_id = '00000000-0000-0000-0000-00000000d033'), 'failed', 'a class with no usable notes fails at once');
-- Other failures still retry, so a busy model does not end a job.
select tests.is((select class_title from public.claim_ai_job()), null::text, 'nothing is left to claim now');

-- ===== Finishing =====
select tests.fails_with('select public.finish_ai_job(j.id, '' '', ''[]'', ''[]'', ''[]'') from public.ai_jobs j where j.class_id = ' || quote_literal(:k14), '22023', 'a blank overview is refused');
select tests.fails_with('select public.finish_ai_job(j.id, ''ok'', ''[{"id":"a","title":"","explanation":"e"}]'', ''[]'', ''[]'') from public.ai_jobs j where j.class_id = ' || quote_literal(:k14), '22023', 'a concept with a blank title is refused');
select tests.is((select status::text from public.ai_jobs where class_id = :k14), 'running', 'and the job is still running');
select public.finish_ai_job(j.id, '  The class covered eigenvalues.  ',
    '[{"id":"a","title":"Eigenvalue","explanation":"A scalar"}]'::jsonb, '[]'::jsonb,
    '[{"id":"b","name":"Spectra","description":""}]'::jsonb)
  from public.ai_jobs j where j.class_id = :k14;
select tests.is((select status::text from public.summaries where class_id = :k14), 'in_review', 'the summary moves to review');
select tests.is((select overview from public.summaries where class_id = :k14), 'The class covered eigenvalues.', 'with the trimmed overview');
select tests.is((select notes_analyzed_count from public.summaries where class_id = :k14), 1, 'and the note count comes from the notes');
select tests.is((select students_analyzed_count from public.summaries where class_id = :k14), 1, 'and the student count too');
select tests.is((select in_review_since is not null from public.summaries where class_id = :k14), true, 'it waits since now');
select tests.is((select status::text from public.ai_jobs where class_id = :k14), 'succeeded', 'the job succeeded');
select tests.fails_with('select public.finish_ai_job(j.id, ''again'', ''[]'', ''[]'', ''[]'') from public.ai_jobs j where j.class_id = ' || quote_literal(:k14), '23514', 'a finished job cannot finish again');
select tests.reset();

-- ===== The teacher finds the draft, and publishes it =====
select tests.login(:t1);
select tests.is((select status::text from public.teacher_reviews where class_title = 'Second'), 'in_review', 'the teacher sees the draft in the review list');
select tests.is((select (public.publish_summary_draft(r.summary_id, r.version, r.overview, r.key_concepts, r.confusion_areas, r.key_topics)).status::text from public.teacher_reviews r where r.class_title = 'Second'), 'published', 'and publishes it as it is');
select tests.reset();

-- ===== An abandoned job =====
select tests.server();
insert into public.class_sessions (id, course_id, title, starts_at, ends_at)
  values ('00000000-0000-0000-0000-00000000d020', :c1, 'Stuck', now() - interval '3 hours', now() - interval '2 hours');
insert into public.summaries (class_id, course_id, status) values ('00000000-0000-0000-0000-00000000d020', :c1, 'processing');
insert into public.ai_jobs (class_id, course_id, kind, status, attempt, started_at)
  values ('00000000-0000-0000-0000-00000000d020', :c1, 'summary', 'running', 1, now() - interval '11 minutes');
select tests.is((select attempt from public.claim_ai_job()), 2, 'a job running for over ten minutes is started again as its next attempt');
update public.ai_jobs set started_at = now() - interval '11 minutes', attempt = 3 where class_id = '00000000-0000-0000-0000-00000000d020';
select tests.rows('select * from public.claim_ai_job()', 0, 'one out of attempts is not claimed again');
select tests.is((select status::text from public.ai_jobs where class_id = '00000000-0000-0000-0000-00000000d020'), 'failed', 'it is failed for good');
select tests.reset();

rollback;

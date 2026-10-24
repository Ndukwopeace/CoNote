-- Telling people about a summary (D111): the teacher when a draft is ready, the students of the
-- course when it is published. Counts and words only, never anything a student wrote.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c4 '''00000000-0000-0000-0000-00000000c004'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''
\set k20 '''00000000-0000-0000-0000-00000000d020'''
\set k21 '''00000000-0000-0000-0000-00000000d021'''
\set sm_draft '''00000000-0000-0000-0000-00000000f002'''

-- Two classes that ended with a note each: K20 in C1 (teacher 1), K21 in C4 (no teacher).
select tests.server();
insert into public.class_sessions (id, course_id, number, title, starts_at, ends_at) values
  (:k20, :c1, 9, 'Eigenvalues', now() - interval '3 hours', now() - interval '2 hours'),
  (:k21, :c4, 1, 'Orphan', now() - interval '3 hours', now() - interval '2 hours');
insert into public.notes (student_id, course_id, class_id, title, content_html)
  values (:s1, :c1, :k20, 'n', '<p>private words</p>');
-- The fixtures have no note in C4; enrol student 1 there so a note can exist.
insert into public.enrollments (course_id, student_id) values (:c4, :s1);
insert into public.notes (student_id, course_id, class_id, title, content_html)
  values (:s1, :c4, :k21, 'n', '<p>private words</p>');
select tests.is(public.queue_summary_jobs(), 2, 'both classes are queued');
-- Each claim takes one queued job and marks it running, which a job must be before it can finish.
select tests.is((select count(*) from public.claim_ai_job()), 1::bigint, 'the first job is claimed');
select tests.is((select count(*) from public.claim_ai_job()), 1::bigint, 'and the second');
select tests.is((select count(*) from public.notifications), 0::bigint, 'queueing and claiming tell nobody');

-- ===== A draft that is ready tells its course''s teacher, once =====
select public.finish_ai_job(j.id, 'The class covered eigenvalues.', '[]', '[]', '[]')
  from public.ai_jobs j where j.class_id = :k20;
select tests.is((select count(*) from public.notifications where user_id = :t1), 1::bigint, 'the teacher of the course is told');
select tests.is((select type::text from public.notifications where user_id = :t1), 'summary', 'with the summary type');
select tests.is((select read from public.notifications where user_id = :t1), false, 'and it starts unread');
select tests.is((select title from public.notifications where user_id = :t1), 'A draft is ready to review', 'the title says what to do');
select tests.is((select body from public.notifications where user_id = :t1), 'MTH 202, class 9: Eigenvalues', 'the body names the course, class number and class title');
select tests.is((select link from public.notifications where user_id = :t1),
  '/teacher/reviews/' || (select id::text from public.summaries where class_id = :k20), 'it links to that draft in the teacher portal');
select tests.is((select count(*) from public.notifications where user_id in (:t2, :s1, :s2, :admin)), 0::bigint, 'nobody else is told, not even the students of the course');
select tests.is((select count(*) from public.notifications where body like '%private words%' or title like '%private words%'), 0::bigint, 'no note text is ever copied into a notice');

-- A course with no teacher: the draft still arrives and nobody is told.
select public.finish_ai_job(j.id, 'Orphan overview.', '[]', '[]', '[]')
  from public.ai_jobs j where j.class_id = :k21;
select tests.is((select status::text from public.summaries where class_id = :k21), 'in_review', 'a course without a teacher still gets its draft');
select tests.is((select count(*) from public.notifications), 1::bigint, 'and no notice is made for a teacher who does not exist');
select tests.reset();

-- ===== What each person can see of it =====
select tests.login(:t1);
select tests.rows('select * from public.notifications', 1, 'the teacher reads their own notice');
select tests.rows('select * from public.notifications where user_id <> auth.uid()', 0, 'and no one else''s');
update public.notifications set read = true;
select tests.is((select count(*) from public.notifications where read), 1::bigint, 'the teacher can mark it read');
select tests.reset();
select tests.login(:t2);
select tests.rows('select * from public.notifications', 0, 'another teacher is not shown it');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.notifications', 0, 'an administrator is not shown it');
select tests.reset();

-- ===== Publishing tells the students of the course =====
-- Teacher 1 has a name; teacher 2, further down, has none.
select tests.server();
update public.profiles set full_name = 'Dr. Okeke' where id = :t1;
select tests.reset();
select tests.login(:t1);
select public.publish_summary_draft(:sm_draft, 1, 'Final text', '[]', '[]', '[]');
select tests.reset();
select tests.is((select count(*) from public.notifications where user_id = :s1 and link like '%/summary'), 1::bigint, 'the enrolled student is told');
select tests.is((select title from public.notifications where user_id = :s1 and link like '%/summary'), 'Summary published', 'the title says what happened');
select tests.is((select body from public.notifications where user_id = :s1 and link like '%/summary'),
  'Dr. Okeke published the summary for MTH 202, class 2.', 'the body names the teacher, the course and the class');
select tests.is((select link from public.notifications where user_id = :s1 and link like '%/summary'),
  '/courses/00000000-0000-0000-0000-00000000c001/classes/00000000-0000-0000-0000-00000000d003/summary', 'it links to the summary');
select tests.is((select count(*) from public.notifications where user_id = :s2), 0::bigint, 'a student who is not in the course is not told');
select tests.is((select count(*) from public.notifications where user_id = :t1 and link like '/courses/%'), 0::bigint, 'and the teacher is not told about their own publish');
select tests.login(:s1);
select tests.is((select count(*) from public.notifications where link like '/teacher/%'), 0::bigint, 'a student never sees the teacher''s notice');
select tests.reset();

-- ===== Only those two moments tell anyone =====
select tests.is((select count(*) from public.notifications), 2::bigint, 'two notices in all: one for the teacher, one for the student');
select tests.login(:t1);
select tests.is((select version from public.save_summary_draft(
  (select id from public.summaries where class_id = :k20), (select version from public.summaries where class_id = :k20),
  'Edited text', '[]', '[]', '[]')), (select version + 1 from public.summaries where class_id = :k20), 'a teacher edits a draft');
select tests.reset();
select tests.is((select count(*) from public.notifications), 2::bigint, 'saving a draft tells nobody');

-- ===== A teacher with no name is still named in a way that reads =====
-- Student 2 joins PHY 101, whose draft belongs to teacher 2, who has no name on their profile.
select tests.server();
insert into public.enrollments (course_id, student_id) values ('00000000-0000-0000-0000-00000000c002', :s2);
select tests.reset();
select tests.login(:t2);
select public.publish_summary_draft('00000000-0000-0000-0000-00000000f003', 1, 'Other final', '[]', '[]', '[]');
select tests.reset();
select tests.is((select body from public.notifications where user_id = :s2), 'Your teacher published the summary for PHY 101, class 1.', 'a teacher without a name becomes "Your teacher"');
select tests.is((select count(*) from public.notifications where user_id = :s1 and body like '%PHY 101%'), 0::bigint, 'and a student of another course is not told');

rollback;

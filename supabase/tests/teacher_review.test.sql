-- The teacher portal's review list, and saving and publishing a draft (D89).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''
\set sm_pub '''00000000-0000-0000-0000-00000000f001'''
\set sm_draft '''00000000-0000-0000-0000-00000000f002'''
\set sm_other '''00000000-0000-0000-0000-00000000f003'''

-- ===== The list belongs to the course's teacher =====
select tests.login(:t1);
select tests.rows('select * from public.teacher_reviews', 2, 'teacher 1 sees the two summaries of their own course');
select tests.is((select course_code from public.teacher_reviews where summary_id = :sm_draft), 'MTH 202', 'the course comes with the summary');
select tests.is((select class_number from public.teacher_reviews where summary_id = :sm_draft), 2, 'and the class number');
select tests.is((select overview from public.teacher_reviews where summary_id = :sm_draft), 'Draft text', 'the draft text comes with it');
select tests.reset();
select tests.login(:t2);
select tests.is((select count(*) from public.teacher_reviews where summary_id = :sm_draft), 0::bigint, 'another teacher does not see this course''s summaries');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.teacher_reviews', 0, 'an administrator reads no draft text');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.teacher_reviews', 0, 'a student reads nothing from it, not even a published summary');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.teacher_reviews', 'a visitor reads nothing');
select tests.reset();

-- ===== Saving =====
select tests.login(:t1);
select tests.is(
  (select version from public.save_summary_draft(:sm_draft, 1, '  New overview  ',
     '[{"id":"a","title":" Idea ","explanation":"Why","extra":"dropped"}]'::jsonb,
     '[{"id":"b","issue":"Confusing","clarification":"Clear"}]'::jsonb,
     '[{"id":"c","name":"Topic","description":""}]'::jsonb)),
  2, 'a save raises the version');
select tests.is((select overview from public.summaries where id = :sm_draft), 'New overview', 'the overview is trimmed');
select tests.is((select key_concepts from public.summaries where id = :sm_draft), '[{"id":"a","title":"Idea","explanation":"Why"}]'::jsonb, 'items keep only their known fields, trimmed');
select tests.is((select status::text from public.summaries where id = :sm_draft), 'in_review', 'saving keeps the stage');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 1, ''x'', ''[]'', ''[]'', ''[]'')', '40001', 'a stale version is refused');
select tests.is((select overview from public.summaries where id = :sm_draft), 'New overview', 'and the newer draft is kept');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''   '', ''[]'', ''[]'', ''[]'')', '22023', 'a blank overview is refused');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''[{"id":"a","title":"","explanation":"e"}]'', ''[]'', ''[]'')', '22023', 'a blank required field is refused');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''{"not":"a list"}'', ''[]'', ''[]'')', '22023', 'a list that is not a list is refused');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''[]'', ''[]'', ''[1]'')', '22023', 'an item that is not an object is refused');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''' || repeat('a', 4001) || ''', ''[]'', ''[]'', ''[]'')', '22023', 'an overview over 4000 characters is refused');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_pub) || ', 1, ''x'', ''[]'', ''[]'', ''[]'')', '23514', 'a published summary cannot change');
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_other) || ', 1, ''x'', ''[]'', ''[]'', ''[]'')', 'P0002', 'another teacher''s summary is not found');
select tests.fails_with('select public.save_summary_draft(''00000000-0000-0000-0000-0000000000ff'', 1, ''x'', ''[]'', ''[]'', ''[]'')', 'P0002', 'an unknown summary is not found');
select tests.reset();
select tests.login(:s1);
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''[]'', ''[]'', ''[]'')', 'P0002', 'a student cannot save a draft');
select tests.reset();
select tests.login(:admin);
select tests.fails_with('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''[]'', ''[]'', ''[]'')', 'P0002', 'an administrator cannot save a draft');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.save_summary_draft(' || quote_literal(:sm_draft) || ', 2, ''x'', ''[]'', ''[]'', ''[]'')', 'a visitor cannot save a draft');
select tests.reset();

-- ===== Publishing with the draft =====
select tests.login(:t1);
select tests.fails_with('select public.publish_summary_draft(' || quote_literal(:sm_draft) || ', 1, ''x'', ''[]'', ''[]'', ''[]'')', '40001', 'publishing a stale version is refused');
select tests.fails_with('select public.publish_summary_draft(' || quote_literal(:sm_draft) || ', 2, '' '', ''[]'', ''[]'', ''[]'')', '22023', 'publishing an invalid draft is refused');
select tests.is((select status::text from public.summaries where id = :sm_draft), 'in_review', 'and nothing was published');
select tests.is(
  (select version from public.publish_summary_draft(:sm_draft, 2, 'Final', '[]', '[]', '[]')),
  3, 'publishing raises the version once');
select tests.is((select status::text from public.summaries where id = :sm_draft), 'published', 'the summary is published');
select tests.is((select overview from public.summaries where id = :sm_draft), 'Final', 'with the text sent');
select tests.is((select reviewed_by::text from public.summaries where id = :sm_draft), '00000000-0000-0000-0000-0000000000b1', 'the reviewer is recorded');
select tests.is((select count(*) from public.summaries where id = :sm_draft and published_at is not null), 1::bigint, 'and the time');
select tests.is((select reviewed_by_name from public.teacher_reviews where summary_id = :sm_draft), (select full_name from public.profiles where id = :t1), 'the list names the reviewer');
select tests.fails_with('select public.publish_summary_draft(' || quote_literal(:sm_draft) || ', 3, ''x'', ''[]'', ''[]'', ''[]'')', '23514', 'a published summary cannot be published again');
select tests.fails_with('select public.publish_summary_draft(' || quote_literal(:sm_other) || ', 1, ''x'', ''[]'', ''[]'', ''[]'')', 'P0002', 'another teacher''s summary cannot be published');
select tests.reset();
select tests.is((select summary_status::text from public.class_sessions where id = :k3), 'published', 'the class stage follows');
select tests.rows('select * from public.audit_logs where action = ''summaries.update'' and entity_id = ' || quote_literal('00000000-0000-0000-0000-00000000f002'), 1, 'publishing is audited');
select tests.rows('select * from public.audit_logs where metadata::text like ''%Final%''', 0, 'and the audit entry holds no draft text');

-- ===== An archived class leaves the list and cannot be reviewed =====
select tests.server();
update public.class_sessions set archived_at = now() where id = '00000000-0000-0000-0000-00000000d001';
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.teacher_reviews', 1, 'a summary in an archived class is left out');
select tests.reset();

rollback;

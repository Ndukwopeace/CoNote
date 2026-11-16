-- D125: anyone signed in can send feedback, the sender and role come from the session, a person
-- cannot send more than ten a day, the table is closed, and only an administrator reads or sorts it.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''

-- ===== Sending =====
select tests.login(:s1);
select tests.affects('select public.submit_feedback(''idea'', ''Dark mode, please'', 5, ''/dashboard'')', 1, 'a student can send feedback');
select tests.fails_with('select public.submit_feedback(''rant'', ''x'')', '22023', 'an unknown kind is refused');
select tests.fails_with('select public.submit_feedback(''bug'', ''   '')', '22023', 'an empty message is refused');
select tests.fails_with('select public.submit_feedback(''bug'', repeat(''x'', 2001))', '22023', 'a message over 2000 characters is refused');
select tests.fails_with('select public.submit_feedback(''bug'', ''x'', 6)', '22023', 'a rating above 5 is refused');
select tests.fails_with('select public.submit_feedback(''bug'', ''x'', 0)', '22023', 'a rating below 1 is refused');
select tests.denied('select * from public.feedback', 'the table is closed to the person who sent it');
select tests.denied('insert into public.feedback (role, kind, message) values (''admin'', ''bug'', ''forged'')', 'a browser cannot write the table directly');
select tests.reset();
select tests.login(:t1);
select tests.affects('select public.submit_feedback(''bug'', ''Button does nothing'', null, ''/teacher/courses'')', 1, 'a teacher can send feedback');
select tests.reset();
select tests.login(:admin);
select tests.affects('select public.submit_feedback(''other'', ''Thanks'')', 1, 'an administrator can send feedback');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.submit_feedback(''bug'', ''x'')', 'a visitor cannot send feedback');
select tests.reset();

-- ===== The daily limit =====
select tests.login(:s2);
select tests.affects('select public.submit_feedback(''other'', ''n'' || g) from generate_series(1, 10) g', 10, 'ten in a day are accepted');
select tests.fails_with('select public.submit_feedback(''other'', ''one too many'')', '54000', 'the eleventh in a day is refused');
select tests.reset();
select tests.login(:s1);
select tests.affects('select public.submit_feedback(''other'', ''still fine'')', 1, 'the limit is per person');
select tests.reset();

-- ===== Reading =====
select tests.login(:admin);
select tests.is((select count(*) from public.admin_list_feedback(p_limit := 100)), 14::bigint, 'an administrator reads all feedback');
select tests.is((select sender_role::text from public.admin_list_feedback(p_kind := 'bug') limit 1), 'teacher', 'the role is the sender''s own, set by the database');
select tests.is((select page from public.admin_list_feedback(p_kind := 'idea') limit 1), '/dashboard', 'the page is kept');
select tests.rows('select * from public.admin_list_feedback(p_limit := 2)', 2, 'a page holds at most the limit');
select tests.is((select max(total_count) from public.admin_list_feedback(p_limit := 2)), 14::bigint, 'the total is reported whatever the page size');
select tests.rows('select * from public.admin_list_feedback(p_limit := 100000)', 14, 'a huge limit is capped, not an error');
select tests.reset();
select tests.login(:t1);
select tests.denied('select * from public.admin_list_feedback()', 'a teacher cannot read feedback');
select tests.denied('select public.admin_set_feedback_status(gen_random_uuid(), ''read'')', 'a teacher cannot change a status');
select tests.reset();
select tests.login(:s1);
select tests.denied('select * from public.admin_list_feedback()', 'a student cannot read feedback');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_list_feedback()', 'a visitor cannot read feedback');
select tests.reset();

-- ===== Sorting =====
select tests.login(:admin);
select tests.rows('select * from public.admin_list_feedback(p_status := ''new'', p_limit := 100)', 14, 'new feedback starts as new');
select tests.affects('select public.admin_set_feedback_status((select id from public.admin_list_feedback(p_kind := ''idea'') limit 1), ''read'')', 1, 'an administrator marks feedback as read');
select tests.rows('select * from public.admin_list_feedback(p_status := ''read'')', 1, 'and can list the read ones');
select tests.fails_with('select public.admin_set_feedback_status(gen_random_uuid(), ''read'')', 'P0002', 'an unknown piece of feedback is not found');
select tests.fails_with('select public.admin_set_feedback_status((select id from public.admin_list_feedback() limit 1), ''deleted'')', '22023', 'an unknown status is refused');
select tests.reset();
select tests.rows('select * from public.audit_logs where action = ''feedback.status_changed''', 1, 'the status change is in the audit log');

rollback;

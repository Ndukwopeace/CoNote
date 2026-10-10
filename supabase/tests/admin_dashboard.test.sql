-- The admin console's dashboard: counts, alerts, the activity series and the activity triggers (D87).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''
\set c4 '''00000000-0000-0000-0000-00000000c004'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''

-- ===== The overview =====
select tests.server();
update public.platform_settings set term_starts_on = '2020-01-01', term_ends_on = '2099-12-31';
select tests.reset();
select tests.login(:admin);
select tests.is((select students from public.admin_overview('UTC')), 2, 'students are counted by role');
select tests.is((select teachers from public.admin_overview('UTC')), 2, 'teachers are counted by role');
select tests.is((select active_courses from public.admin_overview('UTC')), 3, 'archived courses are left out');
select tests.is((select classes_this_term from public.admin_overview('UTC')), 3, 'classes inside the term are counted');
select tests.is((select published_summaries from public.admin_overview('UTC')), 1, 'only published summaries are counted');
select tests.is((select active_ai_jobs from public.admin_overview('UTC')), 0, 'no jobs are running');
select tests.reset();
select tests.server();
update public.platform_settings set term_starts_on = '2020-01-01', term_ends_on = '2020-02-01';
select tests.reset();
select tests.login(:admin);
select tests.is((select classes_this_term from public.admin_overview('UTC')), 0, 'classes outside the term are left out');
select tests.reset();

-- ===== Who may ask =====
select tests.login(:t1);
select tests.denied('select * from public.admin_overview(''UTC'')', 'a teacher cannot read the overview');
select tests.denied('select * from public.admin_alerts(now())', 'a teacher cannot read the alerts');
select tests.denied('select * from public.admin_activity_series(''notes_created'', current_date - 7, current_date, ''UTC'')', 'a teacher cannot read the series');
select tests.reset();
select tests.login(:s1);
select tests.denied('select * from public.admin_overview(''UTC'')', 'a student cannot read the overview');
select tests.rows('select * from public.security_events', 0, 'a student reads no security events');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_alerts(now())', 'a visitor cannot read the alerts');
select tests.denied('select * from public.delivery_failures', 'a visitor reads no delivery failures');
select tests.reset();

-- ===== Alerts =====
select tests.server();
insert into public.security_events (action, created_at) values ('auth.repeated_failed_sign_in', now() - interval '23 hours'), ('auth.repeated_failed_sign_in', now() - interval '25 hours');
insert into public.delivery_failures (created_at) values (now() - interval '1 hour');
insert into public.storage_errors (created_at) values (now() - interval '30 hours');
insert into public.enrollment_requests (course_id, student_id, status) values (:c4, :s2, 'pending'), (:c3, :s2, 'pending');
update public.platform_settings set review_alert_days = 2;
update public.summaries set in_review_since = now() - interval '3 days' where status = 'in_review';
select tests.reset();
select tests.login(:admin);
select tests.is((select count from public.admin_alerts(now()) where kind = 'security_events'), 1, 'only the last 24 hours of security events count');
select tests.is((select count from public.admin_alerts(now()) where kind = 'notifications_failed'), 1, 'delivery failures are counted');
select tests.is((select count from public.admin_alerts(now()) where kind = 'storage_errors'), 0, 'older storage errors are not');
select tests.is((select count from public.admin_alerts(now()) where kind = 'enrollment_requests_waiting'), 1, 'requests on archived courses are not');
select tests.is((select count from public.admin_alerts(now()) where kind = 'summaries_waiting_review'), 2, 'summaries past the review limit are counted');
select tests.is((select days from public.admin_alerts(now()) where kind = 'summaries_waiting_review'), 2, 'with the limit from the settings');
select tests.is((select count from public.admin_alerts(now()) where kind = 'courses_without_teacher'), 1, 'courses in use without a teacher are counted');
select tests.is((select count from public.admin_alerts(now() + interval '2 days') where kind = 'security_events'), 0, 'the clock can be pinned');
select tests.reset();

-- ===== The activity triggers and the series =====
select tests.server();
insert into public.notes (student_id, course_id, class_id, title) values (:s1, :c1, :k1, 'More');
select tests.reset();
select tests.server();
select tests.is((select count(*)::int from public.activity_events where kind = 'note_created'), 2, 'writing a note is recorded as activity');
insert into public.summary_views (summary_id, student_id) values ('00000000-0000-0000-0000-00000000f001', :s1);
select tests.is((select count(*)::int from public.activity_events where kind = 'summary_viewed'), 1, 'opening a summary is recorded');
select tests.reset();
update auth.users set last_sign_in_at = now() where id = :s1;
select tests.server();
select tests.is((select count(*)::int from public.activity_events where kind = 'sign_in'), 1, 'a sign-in is recorded');
select tests.reset();
select tests.login(:admin);
select tests.is((select sum(count)::int from public.admin_activity_series('notes_created', current_date - 1, current_date + 1, 'UTC')), 2, 'the series counts the notes written');
select tests.is((select sum(count)::int from public.admin_activity_series('summaries_published', current_date - 1, current_date + 1, 'UTC')), 1, 'published summaries are counted by day');
select tests.rows('select * from public.admin_activity_series(''notes_created'', current_date + 5, current_date + 9, ''UTC'')', 0, 'days with nothing are left out');
select tests.fails_with('select * from public.admin_activity_series(''x; drop table notes'', current_date, current_date, ''UTC'')', '22023', 'an unknown series is refused');
select tests.reset();

-- Nothing in the dashboard shows note text.
select tests.login(:admin);
select tests.rows('select * from public.notes', 0, 'an administrator still reads no notes');
select tests.reset();

rollback;

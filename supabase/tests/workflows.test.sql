-- Join requests (D76), the two server decisions, sign-up, notes writes and the audit log.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c2 '''00000000-0000-0000-0000-00000000c002'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''
\set c4 '''00000000-0000-0000-0000-00000000c004'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k2 '''00000000-0000-0000-0000-00000000d002'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''
\set sm_draft '''00000000-0000-0000-0000-00000000f002'''
\set sm_pub '''00000000-0000-0000-0000-00000000f001'''

-- ===== Sign-up: a browser can never choose its role =====
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000d1', 'sneaky@x.test', '{"role":"admin","full_name":"Sneaky"}');
select tests.is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'student', 'user metadata cannot set the role');
select tests.is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'Sneaky', 'sign-up keeps the chosen name');
insert into auth.users (id, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-0000000000d2', 'invited@x.test', '{"role":"teacher","status":"pending"}');
select tests.is((select role::text || '/' || status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  'teacher/pending', 'the server can invite a teacher through app metadata');

-- ===== Requests to join =====
select tests.login(:s2);
select tests.affects('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c2) || ', ' || quote_literal(:s2) || ')', 1, 'student asks to join a course in use');
select tests.fails_with('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c2) || ', ' || quote_literal(:s2) || ')', '23505', 'one pending request per course');
select tests.denied('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c3) || ', ' || quote_literal(:s2) || ')', 'archived course takes no requests');
select tests.denied('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c4) || ', ' || quote_literal(:s2) || ')', 'completed course takes no requests');
select tests.denied('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c1) || ', ' || quote_literal(:s1) || ')', 'cannot ask on behalf of another student');
select tests.denied('insert into public.enrollment_requests (course_id, student_id, status) values (' || quote_literal(:c1) || ', ' || quote_literal(:s2) || ', ''approved'')', 'cannot create an already-approved request');
-- The browser names only the course; the student is whoever is signed in (a column default).
select tests.affects('insert into public.enrollment_requests (course_id) values (' || quote_literal(:c1) || ')', 1, 'a request needs no student ID from the browser');
select tests.is((select student_id from public.enrollment_requests where course_id = :c1), :s2::uuid, 'the default student is the signed-in one');
select tests.rows('select * from public.enrollment_requests', 2, 'student reads only their own requests');
select tests.reset();
-- Student 1 is already in C1, so cannot ask for it.
select tests.login(:s1);
select tests.denied('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c1) || ', ' || quote_literal(:s1) || ')', 'cannot ask to join a course already joined');
select tests.rows('select * from public.enrollment_requests', 0, 'another student cannot read the request');
select tests.reset();
-- Teachers have no access.
select tests.login(:t1);
select tests.rows('select * from public.enrollment_requests', 0, 'teacher reads no requests');
select tests.reset();

-- A student cancels their own pending request, but cannot approve it.
select tests.login(:s2);
select tests.denied('update public.enrollment_requests set status = ''approved''', 'student cannot approve their own request');
select tests.affects('update public.enrollment_requests set status = ''cancelled''', 2, 'student cancels their pending requests');
select tests.affects('update public.enrollment_requests set status = ''cancelled''', 0, 'a cancelled request cannot change again');
-- After cancelling, asking again is allowed.
select tests.affects('insert into public.enrollment_requests (course_id, student_id) values (' || quote_literal(:c2) || ', ' || quote_literal(:s2) || ')', 1, 'a cancelled request can be sent again');
select tests.reset();

-- ===== Decisions =====
select tests.login(:s2);
select tests.fails_with('select public.decide_enrollment_request((select id from public.enrollment_requests where status = ''pending''), ''approved'')', '42501', 'student cannot decide a request');
select tests.reset();
select tests.login(:t1);
select tests.fails_with('select public.decide_enrollment_request(gen_random_uuid(), ''approved'')', '42501', 'teacher cannot decide a request');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.enrollment_requests', 3, 'admin reads every request');
select tests.fails_with('select public.decide_enrollment_request(gen_random_uuid(), ''approved'')', 'P0002', 'unknown request is not found');
select tests.fails_with('select public.decide_enrollment_request((select id from public.enrollment_requests where status = ''pending''), ''maybe'')', '22023', 'unknown decision is refused');
select public.decide_enrollment_request((select id from public.enrollment_requests where status = 'pending'), 'approved');
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2) || ' and course_id = ' || quote_literal(:c2), 1, 'approving enrols the student');
select tests.fails_with('select public.decide_enrollment_request((select id from public.enrollment_requests where status = ''approved''), ''declined'')', '23505', 'a request is decided once');
select tests.reset();
-- The student now sees the course and its classes.
select tests.login(:s2);
select tests.rows('select * from public.courses', 1, 'approved student sees the course');
select tests.rows('select * from public.class_sessions', 1, 'approved student sees its classes');
select tests.reset();

-- ===== Publishing =====
select tests.login(:s1);
select tests.fails_with('select public.publish_summary(' || quote_literal(:sm_draft) || ', 1)', 'P0002', 'student cannot publish');
select tests.reset();
select tests.login(:admin);
select tests.fails_with('select public.publish_summary(' || quote_literal(:sm_draft) || ', 1)', 'P0002', 'admin cannot publish (only the teacher does)');
select tests.reset();
select tests.login(:t1);
select tests.is((select version from public.summaries where id = :sm_draft), 1, 'draft starts at version 1');
update public.summaries set overview = 'edited' where id = :sm_draft;
select tests.is((select version from public.summaries where id = :sm_draft), 2, 'an edit bumps the version');
select tests.fails_with('select public.publish_summary(' || quote_literal(:sm_draft) || ', 1)', '40001', 'a stale version is refused');
select public.publish_summary(:sm_draft, 2);
select tests.is((select status::text from public.summaries where id = :sm_draft), 'published', 'the teacher publishes');
select tests.is((select reviewed_by::text from public.summaries where id = :sm_draft), '00000000-0000-0000-0000-0000000000b1', 'publishing records the reviewer');
select tests.fails_with('select public.publish_summary(' || quote_literal(:sm_draft) || ', 3)', '23514', 'a published summary cannot be published again');
select tests.reset();
select tests.is((select summary_status::text from public.class_sessions where id = :k3), 'published', 'the class status follows the summary');
-- Students now read it.
select tests.login(:s1);
select tests.rows('select * from public.summaries', 2, 'students read the newly published summary');
select tests.affects('insert into public.summary_views (summary_id, student_id) values (' || quote_literal(:sm_draft) || ', ' || quote_literal(:s1) || ')', 1, 'a student records a view');
select tests.reset();

-- ===== Notes writes =====
select tests.login(:s1);
select tests.affects('insert into public.notes (student_id, course_id, class_id) values (' || quote_literal(:s1) || ', ' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ')', 1, 'a student writes a note in their course');
select tests.denied('insert into public.notes (student_id, course_id, class_id) values (' || quote_literal(:s1) || ', ' || quote_literal(:c2) || ', ' || quote_literal(:k2) || ')', 'cannot write a note in a course not joined');
select tests.denied('insert into public.notes (student_id, course_id, class_id) values (' || quote_literal(:s2) || ', ' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ')', 'cannot write a note as another student');
select tests.fails_with('insert into public.notes (student_id, course_id, class_id) values (' || quote_literal(:s1) || ', ' || quote_literal(:c1) || ', ' || quote_literal(:k2) || ')', '23503', 'a note''s class must belong to its course');
-- The browser names no author: the signed-in student is the default.
select tests.affects('insert into public.notes (course_id, class_id) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ')', 1, 'a note needs no student ID from the browser');
select tests.rows('select * from public.notes where student_id = ' || quote_literal(:s1) || ' and title is null', 2, 'the default author is the signed-in student');
-- Size limits hold even for a request that skips the app.
select tests.fails_with('insert into public.notes (course_id, class_id, content_html) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', repeat(''x'', 200001))', '23514', 'a huge note is refused');
select tests.fails_with('insert into public.notes (course_id, class_id, tags) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', array_fill(''t''::text, array[11]))', '23514', 'too many tags are refused');
select tests.fails_with('insert into public.notes (course_id, class_id, title) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', repeat(''t'', 121))', '23514', 'a long title is refused');
-- A view is recorded for the signed-in student, without sending an ID.
select tests.affects('insert into public.summary_views (summary_id) values (' || quote_literal(:sm_pub) || ')', 1, 'a view needs no student ID from the browser');
select tests.reset();
select tests.login(:s2);
select tests.affects('delete from public.notes', 0, 'a student cannot delete another student''s notes');
select tests.reset();

-- ===== Audit log =====
select tests.login(:admin);
select tests.rows('select * from public.audit_logs where action = ''enrollment_requests.insert''', 3, 'requests are audited');
select tests.rows('select * from public.audit_logs where action = ''enrollment_requests.update''', 3, 'cancellations and decisions are audited');
select tests.rows('select * from public.audit_logs where action = ''enrollments.insert''', 2, 'enrolments are audited');
select tests.rows('select * from public.audit_logs where action = ''summaries.update''', 1, 'a summary status change is audited');
select tests.rows('select * from public.audit_logs where metadata::text ilike ''%secret%'' or metadata::text ilike ''%edited%''', 0, 'audit entries never hold content');
select tests.reset();
select tests.fails_with('update public.audit_logs set action = ''x''', '42501', 'audit entries cannot be edited');
select tests.fails_with('delete from public.audit_logs', '42501', 'audit entries cannot be deleted');
select tests.server();
select tests.fails_with('delete from public.audit_logs', '42501', 'even the server cannot delete audit entries');
select tests.reset();

rollback;

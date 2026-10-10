-- Row Level Security: who may read and write what (admin REQUIREMENTS 6.3 and 25).
begin;
select tests.seed();

-- IDs used below.
\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c2 '''00000000-0000-0000-0000-00000000c002'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''
\set sm_pub '''00000000-0000-0000-0000-00000000f001'''
\set sm_draft '''00000000-0000-0000-0000-00000000f002'''
\set sm_other '''00000000-0000-0000-0000-00000000f003'''

-- ===== Notes are private: an administrator reads none, a teacher reads none =====
select tests.login(:admin);
select tests.rows('select * from public.notes', 0, 'admin reads no notes');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.notes', 0, 'teacher reads no notes');
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from public.notes', 0, 'another student reads no notes');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.notes', 1, 'author reads their own note');
select tests.reset();

-- Counts are available to the administrator and the course teacher, without content.
select tests.login(:admin);
select tests.rows('select * from public.class_note_counts', 1, 'admin sees note counts');
select tests.reset();
select tests.login(:t2);
select tests.rows('select * from public.class_note_counts', 0, 'other teacher sees no counts for this course');
select tests.reset();

-- ===== Summaries =====
-- A student reads the published summary only, never the draft.
select tests.login(:s1);
select tests.rows('select * from public.summaries', 1, 'student sees only the published summary');
select tests.is((select overview from public.summaries), 'Public text', 'student reads published text');
select tests.affects('update public.summaries set overview = ''hacked''', 0, 'student cannot update a summary');
select tests.denied('update public.summaries set status = ''published''', 'student cannot change a summary status');
select tests.reset();
-- Student 2 is in no course, so sees none.
select tests.login(:s2);
select tests.rows('select * from public.summaries', 0, 'non-enrolled student sees no summaries');
select tests.reset();
-- The administrator sees the pipeline without draft text.
select tests.login(:admin);
select tests.rows('select * from public.summaries', 0, 'admin reads no summary rows');
select tests.rows('select * from public.summary_monitor', 3, 'admin sees summary metadata');
select tests.reset();
-- A teacher edits only a draft in their own course.
select tests.login(:t1);
select tests.rows('select * from public.summaries', 2, 'teacher sees their own course summaries');
select tests.affects('update public.summaries set overview = ''edited'' where id = ' || quote_literal(:sm_draft), 1, 'teacher edits own draft');
select tests.affects('update public.summaries set overview = ''x'' where id = ' || quote_literal(:sm_other), 0, 'teacher cannot edit another course''s draft');
select tests.affects('update public.summaries set overview = ''x'' where id = ' || quote_literal(:sm_pub), 0, 'teacher cannot edit a published summary');
select tests.denied('update public.summaries set status = ''published'' where id = ' || quote_literal(:sm_draft), 'teacher cannot set status directly');
select tests.reset();

-- ===== Courses =====
select tests.login(:t1);
select tests.rows('select * from public.courses', 1, 'teacher sees only their own course in use');
select tests.affects('update public.courses set title = ''x'' where id = ' || quote_literal(:c2), 0, 'teacher cannot update another teacher''s course');
select tests.affects('update public.courses set title = ''x'' where id = ' || quote_literal(:c1), 0, 'teacher cannot update even their own course');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.courses', 1, 'student sees only the course they are in');
select tests.rows('select * from public.class_sessions', 2, 'student sees that course''s classes');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.courses', 4, 'admin sees every course, archived included');
select tests.affects('update public.courses set title = ''Renamed'' where id = ' || quote_literal(:c1), 1, 'admin updates a course');
select tests.reset();

-- ===== Profiles: no one promotes themselves =====
select tests.login(:s1);
select tests.denied('update public.profiles set role = ''admin'' where id = ' || quote_literal(:s1), 'student cannot make themselves admin');
select tests.denied('update public.profiles set status = ''active'' where id = ' || quote_literal(:s1), 'student cannot change their own status');
select tests.affects('update public.profiles set full_name = ''Vic'' where id = ' || quote_literal(:s1), 1, 'student edits their own name');
select tests.affects('update public.profiles set full_name = ''X'' where id = ' || quote_literal(:s2), 0, 'student cannot edit another profile');
-- The database holds the line on what a profile may contain, even for a request that skips the app.
select tests.fails_with('update public.profiles set avatar_url = ''javascript:alert(1)'' where id = ' || quote_literal(:s1), '23514', 'a picture address must be https');
select tests.fails_with('update public.profiles set avatar_url = ''http://tracker.example/p.png'' where id = ' || quote_literal(:s1), '23514', 'a plain http picture address is refused');
select tests.affects('update public.profiles set avatar_url = ''https://cdn.example/p.png'' where id = ' || quote_literal(:s1), 1, 'an https picture address is allowed');
select tests.fails_with('update public.profiles set full_name = repeat(''n'', 101) where id = ' || quote_literal(:s1), '23514', 'a long name is refused');
select tests.fails_with('update public.profiles set phone = repeat(''1'', 21) where id = ' || quote_literal(:s1), '23514', 'a long phone number is refused');
select tests.fails_with('update public.profiles set notification_prefs = ''[1]''::jsonb where id = ' || quote_literal(:s1), '23514', 'notification settings must be an object');
select tests.fails_with('update public.profiles set notification_prefs = jsonb_build_object(''x'', repeat(''y'', 3000)) where id = ' || quote_literal(:s1), '23514', 'huge notification settings are refused');
select tests.rows('select * from public.profiles', 1, 'student reads only their own profile');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.profiles', 5, 'admin reads every profile');
select tests.reset();

-- ===== Teachers' names for enrolled students, without contact details =====
select tests.login(:s1);
select tests.rows('select * from public.course_teachers', 1, 'student sees the teacher of their course');
select tests.reset();

-- ===== Notifications: a person reads their own and marks them read; the server writes them =====
select tests.server();
insert into public.notifications (id, user_id, type, title) values
  ('00000000-0000-0000-0000-00000000a001', :s1, 'summary', 'For student 1'),
  ('00000000-0000-0000-0000-00000000a002', :s2, 'system', 'For student 2');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.notifications', 1, 'a student reads only their own notifications');
select tests.affects('update public.notifications set read = true', 1, 'a student marks their own notification read');
select tests.denied('update public.notifications set title = ''hacked''', 'a student cannot rewrite a notification');
select tests.denied('insert into public.notifications (user_id, type, title) values (' || quote_literal(:s1) || ', ''system'', ''forged'')', 'a student cannot write a notification');
select tests.denied('delete from public.notifications', 'a student cannot delete a notification');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.notifications', 0, 'an administrator reads no one''s notifications');
select tests.reset();

-- ===== Student counts per course: numbers only, and only for courses the caller may see =====
select tests.login(:s1);
select tests.rows('select * from public.course_student_counts', 1, 'student sees the count of their own course');
select tests.is((select student_count from public.course_student_counts), 1, 'the count is right');
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from public.course_student_counts', 0, 'a student in no course sees no counts');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.course_student_counts', 1, 'teacher sees the count of their own course');
select tests.reset();
select tests.login(:t2);
select tests.rows('select * from public.course_student_counts', 0, 'another teacher sees no counts for this course');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.course_student_counts', 1, 'admin sees the counts');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.course_student_counts', 'a visitor reads no counts');
select tests.reset();

-- ===== Operations tables: administrators read, nobody writes =====
select tests.login(:s1);
select tests.rows('select * from public.audit_logs', 0, 'student reads no audit entries');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.ai_jobs', 0, 'teacher reads no AI jobs');
select tests.denied('insert into public.audit_logs (action, entity_type) values (''x'', ''y'')', 'teacher cannot write the audit log');
select tests.reset();
select tests.login(:admin);
select tests.denied('insert into public.audit_logs (action, entity_type) values (''x'', ''y'')', 'admin cannot write the audit log from a browser');
select tests.denied('insert into public.ai_jobs (class_id, course_id) values (' || quote_literal(:k1) || ', ' || quote_literal(:c1) || ')', 'admin cannot write AI jobs from a browser');
select tests.denied('update public.platform_settings set review_alert_days = 9', 'admin cannot write settings from a browser');
select tests.reset();

-- ===== Signed-out visitors =====
-- No view is open to visitors, whatever the platform grants new objects by default.
select tests.is((select count(*)::int from unnest(array['course_teachers','joinable_courses','class_note_counts','summary_monitor','course_student_counts']) v where has_table_privilege('anon', 'public.' || v, 'select')), 0, 'no view is readable by visitors');
select tests.anonymous();
select tests.denied('select * from public.courses', 'a visitor reads nothing');
select tests.reset();

rollback;

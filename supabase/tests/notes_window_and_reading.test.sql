-- D123: notes are written in a window (class start to one hour after its end), the AI draft waits
-- for the window to close, and a teacher or administrator reads notes through two audited functions.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c2 '''00000000-0000-0000-0000-00000000c002'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k2 '''00000000-0000-0000-0000-00000000d002'''
\set k4 '''00000000-0000-0000-0000-00000000d004'''
\set k5 '''00000000-0000-0000-0000-00000000d005'''
\set k6 '''00000000-0000-0000-0000-00000000d006'''
\set k7 '''00000000-0000-0000-0000-00000000d007'''
\set k8 '''00000000-0000-0000-0000-00000000d008'''

-- Classes of course 1 at different moments: K4 is on now, K5 ended 59 minutes ago (still inside the
-- window), K6 ended 61 minutes ago (just outside), K7 ended 30 minutes ago and K8 two hours ago
-- (the last two have a note, for the draft timing below).
insert into public.class_sessions (id, course_id, number, title, starts_at, ends_at) values
  (:k4, :c1, 3, 'On now', now() - interval '30 minutes', now() + interval '30 minutes'),
  (:k5, :c1, 4, 'Ended 59 minutes ago', now() - interval '2 hours', now() - interval '59 minutes'),
  (:k6, :c1, 5, 'Ended 61 minutes ago', now() - interval '2 hours', now() - interval '61 minutes'),
  (:k7, :c1, 6, 'Ended 30 minutes ago', now() - interval '90 minutes', now() - interval '30 minutes'),
  (:k8, :c1, 7, 'Ended 2 hours ago', now() - interval '3 hours', now() - interval '2 hours');

-- ===== The writing window =====
select tests.login(:s1);
select tests.affects('insert into public.notes (course_id, class_id, title) values (' || quote_literal(:c1) || ', ' || quote_literal(:k4) || ', ''During'')', 1, 'a note can be written while the class is on');
select tests.affects('insert into public.notes (course_id, class_id, title) values (' || quote_literal(:c1) || ', ' || quote_literal(:k5) || ', ''Soon after'')', 1, 'a note can be written 59 minutes after the class ended');
select tests.denied('insert into public.notes (course_id, class_id, title) values (' || quote_literal(:c1) || ', ' || quote_literal(:k6) || ', ''Too late'')', 'a note cannot be written 61 minutes after the class ended');
select tests.denied('insert into public.notes (course_id, class_id, title) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', ''Days later'')', 'a note cannot be written days after the class');
-- An old note can be read and deleted by its author, but not edited.
select tests.denied('update public.notes set title = ''Changed'' where id = ''00000000-0000-0000-0000-00000000e001''', 'an old note cannot be edited once the window has closed');
select tests.affects('update public.notes set title = ''Edited'' where title = ''During''', 1, 'a note can be edited while the window is open');
select tests.affects('delete from public.notes where id = ''00000000-0000-0000-0000-00000000e001''', 1, 'an old note can still be deleted by its author');
select tests.reset();

-- ===== The AI draft waits for the window to close =====
insert into public.notes (student_id, course_id, class_id, title, content_html) values
  (:s1, :c1, :k7, 'Ended 30 minutes ago', '<p>a</p>'),
  (:s1, :c1, :k8, 'Ended 2 hours ago', '<p>b</p>');
select tests.server();
select tests.is(public.queue_summary_jobs(now()), 1, 'only the class whose window has closed is queued');
select tests.reset();
select tests.rows('select * from public.ai_jobs where class_id = ' || quote_literal(:k8), 1, 'the class that ended two hours ago has a draft job');
select tests.rows('select * from public.ai_jobs where class_id = ' || quote_literal(:k7), 0, 'the class that ended 30 minutes ago waits');

-- ===== Reading notes =====
-- Three more notes in the class that is on now, from a second enrolled student.
insert into public.enrollments (course_id, student_id) values (:c1, :s2);
update public.profiles set full_name = 'Ada Student', student_number = 'U2026/0001' where id = :s1;
update public.profiles set full_name = 'Bo Learner' where id = :s2;
insert into public.notes (student_id, course_id, class_id, title, content_html) values
  (:s2, :c1, :k4, 'Bo one', '<p>bo 1</p>'),
  (:s2, :c1, :k4, 'Bo two', '<p>bo 2</p>');
-- A note in the other teacher's course.
insert into public.enrollments (course_id, student_id) values (:c2, :s1);
insert into public.notes (student_id, course_id, class_id, title) values (:s1, :c2, :k2, 'Physics note');

-- A teacher reads the notes of the course they teach, with names.
select tests.login(:t1);
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ')', 3, 'a teacher reads the notes of a class they teach');
select tests.is((select count(distinct student_name) from public.search_notes(p_class := :k4)), 2::bigint, 'each note carries its author''s name');
select tests.is((select student_name from public.search_notes(p_class := :k4, p_student_text := 'bo') limit 1), 'Bo Learner', 'a teacher searches a student by part of the name');
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ', p_student_text := ''U2026/0001'')', 1, 'or by student number');
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ', p_student_id := ' || quote_literal(:s2) || ')', 2, 'or by the exact student');
select tests.rows('select * from public.search_notes(p_student_text := ''%'')', 0, 'a percent sign is plain text, not a wildcard');
select tests.is((select max(total_count) from public.search_notes(p_class := :k4, p_limit := 2)), 3::bigint, 'the total is reported whatever the page size');
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ', p_limit := 2)', 2, 'a page holds at most the limit');
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ', p_limit := 100000)', 3, 'a huge limit is capped, not an error');
select tests.rows('select * from public.search_notes(p_course := ' || quote_literal(:c2) || ')', 0, 'a teacher gets nothing from a course they do not teach');
select tests.fails_with('select * from public.search_notes(p_student_text := repeat(''x'', 101))', '22023', 'an over-long search is refused');
select tests.rows('select * from public.notes', 0, 'the table itself stays closed to a teacher');
select tests.reset();

-- The other teacher sees only their own course.
select tests.login(:t2);
select tests.rows('select * from public.search_notes()', 1, 'another teacher sees only the notes of their own course');
select tests.rows('select * from public.search_notes(p_class := ' || quote_literal(:k4) || ')', 0, 'and none of a class they do not teach');
select tests.reset();

-- An administrator reads any course.
select tests.login(:admin);
select tests.rows('select * from public.search_notes(p_limit := 100)', 7, 'an administrator reads the notes of every course');
select tests.rows('select * from public.search_notes(p_course := ' || quote_literal(:c2) || ')', 1, 'and can narrow to one course');
select tests.rows('select * from public.notes', 0, 'the table itself stays closed to an administrator');
select tests.reset();

-- Students and visitors are refused.
select tests.login(:s1);
select tests.denied('select * from public.search_notes()', 'a student cannot read notes through the search');
select tests.denied('select * from public.class_note_roster(' || quote_literal(:k4) || ')', 'a student cannot read a roster');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.search_notes()', 'a visitor cannot read notes');
select tests.denied('select * from public.class_note_roster(' || quote_literal(:k4) || ')', 'a visitor cannot read a roster');
select tests.reset();

-- ===== Who has written and who has not =====
select tests.login(:t1);
select tests.rows('select * from public.class_note_roster(' || quote_literal(:k4) || ')', 2, 'the roster lists every enrolled student');
select tests.is((select note_count from public.class_note_roster(:k4) where student_id = :s2), 2, 'with how many notes each wrote');
select tests.is((select note_count from public.class_note_roster(:k5) where student_id = :s2), 0, 'and zero for a student who wrote none');
select tests.fails_with('select * from public.class_note_roster(' || quote_literal(:k2) || ')', '42501', 'a teacher cannot read the roster of a class they do not teach');
select tests.fails_with('select * from public.class_note_roster(''00000000-0000-0000-0000-00000000dead'')', 'P0002', 'an unknown class is not found');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.class_note_roster(' || quote_literal(:k2) || ')', 1, 'an administrator reads the roster of any class');
select tests.reset();

-- ===== Every use is recorded, and never with the note text =====
select tests.is((select count(*) from public.audit_logs where action = 'notes.viewed' and actor_id = :t1), 13::bigint, 'each use by the first teacher is in the audit log, and refused calls are not');
select tests.rows('select * from public.audit_logs where action = ''notes.viewed'' and metadata::text ilike ''%bo 1%''', 0, 'the audit log never holds note text');
select tests.is((select actor_role::text from public.audit_logs where action = 'notes.viewed' and actor_id = :admin limit 1), 'admin', 'the log says who looked, and in which role');

rollback;

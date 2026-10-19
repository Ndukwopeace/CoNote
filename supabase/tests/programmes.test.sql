-- Programmes (D105): who may manage them, what a student may see and join, and the timetable
-- import. A student joining a programme is enrolled in all its courses in use, in one step.
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

-- ===== Only administrators manage programmes =====
select tests.login(:admin);
select tests.affects('insert into public.programmes (code, name) values (''SWE'', ''Software Engineering'')', 1, 'an administrator adds a programme');
select tests.affects('insert into public.programmes (code, name) values (''CSN'', ''Cyber Security'')', 1, 'and a second one');
select tests.fails_with('insert into public.programmes (code, name) values (''swe'', ''Again'')', '23505', 'a code is unique in any letter case');
select tests.reset();

select tests.login(:s1);
select tests.denied('insert into public.programmes (code, name) values (''HACK'', ''Hack'')', 'a student cannot add a programme');
select tests.rows('select * from public.programmes', 0, 'a student cannot read the table itself');
select tests.reset();
select tests.login(:t1);
select tests.denied('insert into public.programmes (code, name) values (''HACK'', ''Hack'')', 'a teacher cannot add a programme');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.programmes', 'a visitor reads nothing');
select tests.denied('select * from public.joinable_programmes', 'a visitor cannot read the student list');
select tests.reset();

-- The SWE programme has C1 and C2 in use, the archived C3 and the completed C4. CSN has none.
select tests.login(:admin);
insert into public.programme_courses (programme_id, course_id)
  select p.id, c.id from public.programmes p, public.courses c
  where p.code = 'SWE' and c.id in (:c1, :c2, :c3, :c4);
select tests.reset();

-- The programmes' IDs, read as the runner: a student cannot read the table themselves.
select id as swe from public.programmes where code = 'SWE' \gset
select id as csn from public.programmes where code = 'CSN' \gset

-- ===== The admin list =====
select tests.login(:admin);
select tests.rows('select * from public.admin_programmes', 2, 'an administrator lists every programme');
select tests.is((select course_count from public.admin_programmes where code = 'SWE'), 4, 'the admin count includes every linked course');
select tests.is((select student_count from public.admin_programmes where code = 'SWE'), 0, 'nobody has joined yet');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.admin_programmes', 0, 'a student sees none of the admin list');
select tests.reset();

-- ===== What a student sees =====
select tests.login(:s2);
select tests.rows('select * from public.joinable_programmes', 2, 'a student sees the open programmes');
select tests.is((select course_count from public.joinable_programmes where code = 'SWE'), 2, 'only courses in use count');
select tests.is((select course_codes from public.joinable_programmes where code = 'SWE'), array['MTH 202', 'PHY 101'], 'the codes they would join, A to Z');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'none', 'not theirs yet');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.joinable_programmes', 0, 'a teacher sees none');
select tests.reset();

-- A closed programme and an archived one are not offered.
select tests.login(:admin);
update public.programmes set open_enrolment = false where code = 'CSN';
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from public.joinable_programmes', 1, 'a closed programme is hidden');
select tests.reset();

-- ===== Asking to join =====
select tests.login(:admin);
insert into public.programmes (code, name) values ('OTH', 'Another year');
select tests.reset();
select id as oth from public.programmes where code = 'OTH' \gset

select tests.login(:s2);
select tests.denied('update public.profiles set programme_id = ' || quote_literal(:'swe') || ' where id = ' || quote_literal(:s2), 'a student cannot set their programme directly');
select tests.fails_with('select public.join_programme(' || quote_literal(:'swe') || ')', '42883', 'the old self-service join no longer exists');
select tests.denied('insert into public.programme_requests (programme_id) values (' || quote_literal(:'swe') || ')', 'a student cannot write a request directly');
select public.request_programme(:'swe') as req2 \gset
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2), 0, 'asking enrols nothing');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'pending', 'the list shows the request as waiting');
select tests.is((select request_id from public.joinable_programmes where code = 'SWE'), (:'req2')::uuid, 'and carries its ID');
select tests.is((select programme_id from public.profiles where id = :s2), null::uuid, 'no programme is theirs yet');
select tests.fails_with('select public.request_programme(' || quote_literal(:'swe') || ')', '23505', 'the same programme cannot be asked twice');
select tests.fails_with('select public.request_programme(' || quote_literal(:'oth') || ')', '23505', 'only one request waits at a time');
select tests.fails_with('select public.request_programme(' || quote_literal(:'csn') || ')', 'P0002', 'a closed programme cannot be asked');
select tests.fails_with('select public.request_programme(gen_random_uuid())', 'P0002', 'an unknown programme answers the same');
select tests.rows('select * from public.programme_requests', 1, 'a student reads their own request');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.programme_requests', 0, 'another student reads none of it');
select tests.fails_with('select public.cancel_programme_request(' || quote_literal(:'req2') || ')', 'P0002', 'another student cannot withdraw it');
select tests.reset();

-- Withdrawing, and asking again.
select tests.login(:s2);
select public.cancel_programme_request(:'req2');
select tests.is((select status::text from public.programme_requests where id = (:'req2')::uuid), 'cancelled', 'a request can be withdrawn');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'none', 'and the list goes back to none');
select tests.fails_with('select public.cancel_programme_request(' || quote_literal(:'req2') || ')', '23505', 'a withdrawn request cannot be withdrawn again');
select public.request_programme(:'swe') as req3 \gset
select tests.reset();

-- ===== What an administrator sees and decides =====
select tests.login(:admin);
select tests.rows('select * from public.admin_programme_requests where status = ''pending''', 1, 'the administrator sees the waiting request');
select tests.is((select student_email from public.admin_programme_requests where id = (:'req3')::uuid), (select email from public.profiles where id = :s2), 'with who asked');
select tests.is((select pending_request_count from public.admin_programmes where code = 'SWE'), 1, 'the programme counts it');
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from public.admin_programme_requests', 0, 'a student sees none of the administrator list');
select tests.fails_with('select public.decide_programme_request(' || quote_literal(:'req3') || ', ''approved'')', '42501', 'a student cannot approve their own request');
select tests.reset();
select tests.login(:t1);
select tests.fails_with('select public.decide_programme_request(' || quote_literal(:'req3') || ', ''approved'')', '42501', 'a teacher cannot decide');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.decide_programme_request(gen_random_uuid(), ''approved'')', 'a visitor cannot decide');
select tests.denied('select public.request_programme(gen_random_uuid())', 'a visitor cannot ask');
select tests.reset();

select tests.login(:admin);
select tests.fails_with('select public.decide_programme_request(' || quote_literal(:'req3') || ', ''maybe'')', '22023', 'only two decisions exist');
select tests.fails_with('select public.decide_programme_request(gen_random_uuid(), ''approved'')', 'P0002', 'an unknown request is not found');
select tests.fails_with('select public.request_programme(' || quote_literal(:'swe') || ')', '42501', 'an administrator cannot ask to join');
select public.decide_programme_request(:'req3', 'declined');
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2), 0, 'a declined request enrols nothing');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'declined', 'the list says declined');
select public.request_programme(:'swe') as req4 \gset
select tests.reset();

select tests.login(:admin);
select tests.fails_with('select public.decide_programme_request(' || quote_literal(:'req3') || ', ''approved'')', '23505', 'a decided request is not decided again');
select public.decide_programme_request(:'req4', 'approved');
select tests.reset();

-- Approval enrols the courses in use and remembers the programme.
select tests.login(:s2);
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2), 2, 'approval enrols the courses in use');
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2) || ' and course_id in (' || quote_literal(:c3) || ', ' || quote_literal(:c4) || ')', 0, 'the archived and the completed course are left out');
select tests.is((select programme_id from public.profiles where id = :s2), (:'swe')::uuid, 'the programme is remembered on the profile');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'enrolled', 'the list marks it as theirs');
-- One programme only.
select tests.fails_with('select public.request_programme(' || quote_literal(:'oth') || ')', '23505', 'a student in a programme cannot ask for another');
select tests.fails_with('select public.request_programme(' || quote_literal(:'swe') || ')', '23505', 'nor for their own again');
select tests.reset();

-- Student 1 was already in C1: only C2 is new.
select tests.login(:s1);
select public.request_programme(:'swe') as req5 \gset
select tests.reset();
select tests.login(:admin);
select public.decide_programme_request(:'req5', 'approved');
select tests.is((select student_count from public.admin_programmes where code = 'SWE'), 2, 'the admin count follows the profiles');
select tests.is((select pending_request_count from public.admin_programmes where code = 'SWE'), 0, 'and nothing waits any more');
select tests.rows('select * from public.admin_programme_members where programme_id = ' || quote_literal(:'swe'), 2, 'the administrator lists the members');
select tests.reset();
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s1), 2, 'a course already joined is not counted twice');

-- ===== Removing a student from a programme =====
select tests.login(:s2);
select tests.rows('select * from public.admin_programme_members', 0, 'and sees none');
select tests.fails_with('select public.remove_from_programme(' || quote_literal(:s2) || ')', '42501', 'a student cannot remove anyone, even themselves');
select tests.reset();
select tests.login(:t1);
select tests.fails_with('select public.remove_from_programme(' || quote_literal(:s2) || ')', '42501', 'a teacher cannot remove anyone');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.remove_from_programme(gen_random_uuid())', 'a visitor cannot remove anyone');
select tests.reset();
select tests.login(:admin);
select tests.fails_with('select public.remove_from_programme(' || quote_literal(:t1) || ')', 'P0002', 'only a student in a programme is found');
select tests.is((select public.remove_from_programme(:s2)), 2, 'removing takes the student out of the courses of the programme');
select tests.is((select student_count from public.admin_programmes where code = 'SWE'), 1, 'the member count drops');
select tests.is((select count(*) from public.audit_logs where action = 'programme_members.remove'), 1::bigint, 'the removal is audited');
select tests.is((select metadata ->> 'coursesRemoved' from public.audit_logs where action = 'programme_members.remove'), '2', 'with a count and nothing else');
select tests.reset();
select tests.login(:s2);
select tests.is((select programme_id from public.profiles where id = :s2), null::uuid, 'the programme is cleared from the profile');
select tests.rows('select * from public.enrollments where student_id = ' || quote_literal(:s2), 0, 'and the courses are gone');
select tests.is((select membership from public.joinable_programmes where code = 'SWE'), 'none', 'the list offers it again');
select tests.reset();
-- The student can ask again, for the same programme or another.
select tests.login(:s2);
select public.request_programme(:'oth') as req6 \gset
select tests.reset();
select tests.login(:admin);
select public.decide_programme_request(:'req6', 'declined');
select tests.reset();

-- The audit log records the requests and the decisions.
select tests.login(:admin);
select tests.is((select count(*) from public.audit_logs where action = 'programme_requests.insert') >= 5, true, 'requests are audited');
select tests.is((select count(*) from public.audit_logs where action = 'programme_requests.update') >= 5, true, 'decisions and withdrawals are audited');
select tests.reset();

-- An archived programme is refused too.
select tests.login(:admin);
update public.programmes set archived_at = now() where code = 'SWE';
select tests.reset();
select tests.login(:s2);
select tests.fails_with('select public.request_programme(' || quote_literal(:'swe') || ')', 'P0002', 'an archived programme cannot be asked');
select tests.reset();

-- ===== The timetable import =====
select $json${
  "timezone": "Africa/Douala",
  "programmes": [{"code": "SWE", "name": "Software Engineering", "courseCodes": ["MTH 202", "CYB 101"]},
                 {"code": "BMS", "name": "Business Management", "courseCodes": ["CYB 101"]}],
  "courses": [
    {"code": "CYB 101", "title": "Intro to Cybersecurity", "teacherId": null,
     "sessions": [{"start": "2026-10-20T08:00", "end": "2026-10-20T12:00", "title": "Week 1"},
                  {"start": "2026-10-27T08:00", "end": "2026-10-27T12:00", "title": "Week 2"}]},
    {"code": "MTH 202", "title": "Not used: the course exists", "teacherId": "00000000-0000-0000-0000-0000000000b2",
     "sessions": [{"start": "2026-10-19T08:00", "end": "2026-10-19T12:00", "title": "Week 1"}]}
  ]
}$json$::jsonb as payload \gset

select tests.login(:s1);
select tests.fails_with('select public.import_timetable(' || quote_literal(:'payload') || '::jsonb, true)', '42501', 'a student cannot import');
select tests.reset();
select tests.login(:t1);
select tests.fails_with('select public.import_timetable(' || quote_literal(:'payload') || '::jsonb, true)', '42501', 'a teacher cannot import');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.import_timetable(' || quote_literal(:'payload') || '::jsonb, true)', 'a visitor cannot import');
select tests.reset();

select tests.login(:admin);
-- A dry run reports what would happen and changes nothing.
select tests.is((select (public.import_timetable(:'payload'::jsonb, true) ->> 'coursesCreated')::integer), 1, 'a dry run counts the course it would create');
select tests.is((select (public.import_timetable(:'payload'::jsonb, true) ->> 'coursesExisting')::integer), 1, 'and the one that exists');
select tests.rows('select * from public.courses where code = ''CYB 101''', 0, 'a dry run created nothing');
select tests.rows('select * from public.programmes where code = ''BMS''', 0, 'not even a programme');

-- The real run.
select tests.is((select (public.import_timetable(:'payload'::jsonb, false) ->> 'classesCreated')::integer), 3, 'the run creates the classes');
select tests.rows('select * from public.courses where code = ''CYB 101''', 1, 'the new course exists');
select tests.is((select title from public.courses where code = 'CYB 101'), 'Intro to Cybersecurity', 'with its title');
select tests.is((select title from public.courses where code = 'MTH 202'), 'Linear Algebra', 'an existing course keeps its own title');
select tests.is((select teacher_id from public.courses where code = 'MTH 202'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'and its teacher');
select tests.is((select count(*)::integer from public.class_sessions k join public.courses c on c.id = k.course_id where c.code = 'CYB 101'), 2, 'two classes for the new course');
select tests.is((select min(starts_at) from public.class_sessions k join public.courses c on c.id = k.course_id where c.code = 'CYB 101'), '2026-10-20 07:00:00+00'::timestamptz, 'times are read in Douala, one hour ahead of UTC');
select tests.is((select max(number) from public.class_sessions k join public.courses c on c.id = k.course_id where c.code = 'CYB 101'), 2, 'numbered in order');
select tests.is((select status::text from public.courses where code = 'CYB 101'),
  case when now() < '2026-10-20 07:00:00+00' then 'upcoming' when now() > '2026-10-27 11:00:00+00' then 'completed' else 'ongoing' end,
  'a new course is upcoming, ongoing or completed by where today falls in its classes');
select tests.rows('select * from public.programme_courses pc join public.programmes p on p.id = pc.programme_id where p.code = ''BMS''', 1, 'the new programme holds its course');
select tests.rows('select * from public.programmes where code = ''BMS''', 1, 'a new programme is created');

-- Running it again changes nothing.
select tests.is((select (public.import_timetable(:'payload'::jsonb, false) ->> 'classesCreated')::integer), 0, 'a second run adds no classes');
select tests.is((select (public.import_timetable(:'payload'::jsonb, false) ->> 'classesSkipped')::integer), 3, 'it skips the ones that exist');
select tests.is((select count(*)::integer from public.programme_courses), 6, 'and links nothing twice');

-- It is written to the audit log with counts only.
select tests.reset();
select tests.is((select count(*)::integer from public.audit_logs where action = 'timetable.import'), 3, 'each real run is audited, a dry run is not');
select tests.is((select count(*)::integer from public.audit_logs where action = 'timetable.import' and (metadata ->> 'classesCreated')::integer = 3), 1, 'with its counts');

-- ===== A bad file is refused whole =====
select tests.login(:admin);
select tests.fails_with('select public.import_timetable(''{"timezone": "Mars/Base", "programmes": [], "courses": []}''::jsonb, false)', '22023', 'an unknown time zone');
select tests.fails_with('select public.import_timetable(''{"timezone": "Africa/Douala", "programmes": [], "courses": [{"code": "", "title": "x", "teacherId": null, "sessions": []}]}''::jsonb, false)', '22023', 'a course without a code');
select tests.fails_with('select public.import_timetable(''{"timezone": "Africa/Douala", "programmes": [], "courses": [{"code": "ABC 100", "title": "x", "teacherId": null, "sessions": [{"start": "2026-10-20T12:00", "end": "2026-10-20T08:00", "title": "Bad"}]}]}''::jsonb, false)', '22023', 'a class that ends before it starts');
select tests.fails_with('select public.import_timetable(''{"timezone": "Africa/Douala", "programmes": [], "courses": [{"code": "ABC 100", "title": "x", "teacherId": "00000000-0000-0000-0000-0000000000c1", "sessions": []}]}''::jsonb, false)', '23514', 'a student cannot be made a teacher');
select tests.rows('select * from public.courses where code = ''ABC 100''', 0, 'nothing from a refused file is kept');
select tests.fails_with('select public.import_timetable(''{"timezone": "Africa/Douala", "programmes": [], "courses": [{"code": "BAD", "title": "x", "teacherId": null, "sessions": []}]}''::jsonb, false)', '22023', 'a course code in the wrong form');
select tests.fails_with('select public.import_timetable(''{"timezone": "Africa/Douala", "programmes": [{"code": "X-Y1", "name": "X", "courseCodes": ["NOPE 999"]}], "courses": []}''::jsonb, false)', '22023', 'a programme naming a course that does not exist');
select tests.fails_with('select public.import_timetable(''[]''::jsonb, false)', '22023', 'a payload of the wrong shape');
-- A code is matched however it is spaced or cased: "mth202" is MTH 202, which exists.
select tests.is((select (public.import_timetable('{"timezone": "Africa/Douala", "programmes": [], "courses": [{"code": "mth202", "title": "x", "teacherId": null, "sessions": []}]}'::jsonb, true) ->> 'coursesExisting')::integer), 1, 'a code is matched in any letter case and spacing');
select tests.reset();

rollback;

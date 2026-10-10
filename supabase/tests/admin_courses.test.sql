-- The admin console's course list, the teacher check and class numbering (D84).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c2 '''00000000-0000-0000-0000-00000000c002'''
\set c4 '''00000000-0000-0000-0000-00000000c004'''

-- ===== The list belongs to administrators =====
select tests.login(:admin);
select tests.rows('select * from public.admin_courses', 4, 'admin sees every course, archived included');
select tests.is((select student_count from public.admin_courses where id = :c1), 1, 'the student count is right');
select tests.is((select class_count from public.admin_courses where id = :c1), 2, 'the class count is right');
select tests.is((select teacher_name from public.admin_courses where id = :c1), '', 'the teacher name comes from the profile');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.admin_courses', 0, 'a teacher sees none');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.admin_courses', 0, 'a student sees none');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_courses', 'a visitor reads nothing');
select tests.reset();

-- Requests waiting are counted, decided ones are not.
select tests.server();
insert into public.enrollment_requests (course_id, student_id, status) values
  (:c4, '00000000-0000-0000-0000-0000000000c2', 'pending'),
  (:c4, '00000000-0000-0000-0000-0000000000c1', 'declined');
select tests.reset();
select tests.login(:admin);
select tests.is((select pending_request_count from public.admin_courses where id = :c4), 1, 'only waiting requests are counted');
select tests.reset();

-- ===== A teacher must be an active teacher =====
select tests.login(:admin);
select tests.fails_with('update public.courses set teacher_id = ' || quote_literal('00000000-0000-0000-0000-0000000000c1') || ' where id = ' || quote_literal(:c4), '23514', 'a student cannot teach a course');
select tests.affects('update public.courses set teacher_id = ' || quote_literal(:t1) || ' where id = ' || quote_literal(:c4), 1, 'an active teacher can be assigned');
select tests.reset();
-- A teacher who is deactivated later may stay; a different inactive one may not come.
select tests.server();
update public.profiles set status = 'inactive' where id = :t1;
select tests.reset();
select tests.login(:admin);
select tests.affects('update public.courses set title = ''Renamed'' where id = ' || quote_literal(:c4), 1, 'an edit keeps a teacher who is no longer active');
select tests.fails_with('update public.courses set teacher_id = ' || quote_literal(:t1) || ' where id = ' || quote_literal(:c2), '23514', 'an inactive teacher cannot be assigned');
select tests.affects('update public.courses set teacher_id = null where id = ' || quote_literal(:c4), 1, 'a teacher can be removed');
select tests.reset();

-- ===== Class numbers =====
select tests.login(:admin);
insert into public.class_sessions (course_id, title, starts_at, ends_at)
  values (:c1, 'Eigenvalues', now(), now() + interval '1 hour');
select tests.is((select number from public.class_sessions where title = 'Eigenvalues'), 3, 'a new class takes the next number');
update public.class_sessions set archived_at = now() where title = 'Eigenvalues';
insert into public.class_sessions (course_id, title, starts_at, ends_at)
  values (:c1, 'Spaces', now(), now() + interval '1 hour');
select tests.is((select number from public.class_sessions where title = 'Spaces'), 4, 'an archived class keeps its number');
insert into public.class_sessions (course_id, title, starts_at, ends_at)
  values (:c2, 'Forces', now(), now() + interval '1 hour');
select tests.is((select number from public.class_sessions where title = 'Forces'), 2, 'each course counts on its own');
select tests.reset();

-- ===== Departments for the filters =====
select tests.server();
update public.profiles set department = 'Mathematics' where id = :t1;
update public.courses set department = 'Physics' where id = :c2;
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.admin_departments', 2, 'the departments in use are listed once each');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.admin_departments', 0, 'a teacher sees no departments');
select tests.reset();

-- ===== Bulk enrolment lookup =====
select tests.login(:admin);
select tests.rows('select * from public.admin_match_people(array[''STUDENT1@X.TEST'', '' teacher1@x.test '', ''nobody@x.test''])', 2, 'emails match in any letter case');
select tests.reset();
select tests.login(:s1);
select tests.denied('select * from public.admin_match_people(array[''student1@x.test''])', 'a student cannot look people up');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_match_people(array[''student1@x.test''])', 'a visitor cannot look people up');
select tests.reset();

-- ===== Approving needs an active student =====
select tests.server();
update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000c2';
select tests.reset();
select tests.login(:admin);
select tests.fails_with('select public.decide_enrollment_request((select id from public.enrollment_requests where student_id = ''00000000-0000-0000-0000-0000000000c2''), ''approved'')', '22023', 'a suspended student cannot be approved');
select tests.is((select status::text from public.enrollment_requests where student_id = '00000000-0000-0000-0000-0000000000c2'), 'pending', 'the request stays waiting');
select tests.is((select (public.decide_enrollment_request((select id from public.enrollment_requests where student_id = '00000000-0000-0000-0000-0000000000c2'), 'declined')).status::text), 'declined', 'a suspended student''s request can still be declined');
select tests.reset();

rollback;

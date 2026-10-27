-- Courses chosen when a teacher is invited (D116): kept with the invitation, handed over when the
-- teacher accepts it, and visible only to administrators until then.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c2 '''00000000-0000-0000-0000-00000000c002'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''
\set c4 '''00000000-0000-0000-0000-00000000c004'''

-- Teacher 2 is a new invitation. Three courses were chosen for them: C4 (nobody teaches it), C1
-- (teacher 1 does) and C3 (archived). Student 2 is invited too, and a row was written for them by
-- mistake: it must never turn into a course.
select tests.server();
update public.profiles set status = 'pending' where id = :t2;
update public.courses set teacher_id = null where id = :c2;
update public.profiles set status = 'pending' where id = :s2;
insert into public.invited_courses (user_id, course_id) values (:t2, :c4), (:t2, :c1), (:t2, :c3), (:s2, :c4);
select tests.reset();

-- ===== Who can read what was chosen =====
select tests.login(:admin);
select tests.rows('select * from public.admin_invited_courses where user_id = ' || quote_literal(:t2), 2, 'an administrator sees the chosen courses in use');
select tests.is((select string_agg(code, ',' order by code) from public.admin_invited_courses where user_id = :t2), 'MTH 101,MTH 202', 'by code, with the archived one left out');
select tests.denied('select * from public.invited_courses', 'the table itself is closed even to an administrator');
select tests.reset();
select tests.login(:t2);
select tests.rows('select * from public.admin_invited_courses', 0, 'the invited teacher does not see the list through the view');
select tests.denied('select * from public.invited_courses', 'nor the table');
select tests.denied('insert into public.invited_courses (user_id, course_id) values (' || quote_literal(:t2) || ', ' || quote_literal(:c2) || ')', 'and cannot give themselves a course');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.admin_invited_courses', 0, 'a student sees none');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_invited_courses', 'a visitor reads nothing');
select tests.reset();

-- ===== Someone else accepting changes nothing =====
select tests.login(:s1);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select teacher_id from public.courses where id = :c4), null, 'another account accepting gives no course away');
select tests.is((select count(*)::int from public.invited_courses where user_id = :t2), 3, 'and the choice is kept');
select tests.reset();

-- ===== The invited teacher accepts =====
select tests.login(:t2);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select status::text from public.profiles where id = :t2), 'active', 'accepting activates the teacher');
select tests.is((select teacher_id from public.courses where id = :c4), :t2::uuid, 'a course nobody taught is now theirs');
select tests.is((select teacher_id from public.courses where id = :c1), :t2::uuid, 'a course another teacher had changes hands, as when an administrator assigns it');
select tests.is((select teacher_id from public.courses where id = :c3), :t1::uuid, 'an archived course is left alone');
select tests.is((select count(*)::int from public.invited_courses where user_id = :t2), 0, 'the choice is used up');
select tests.reset();
select tests.login(:t2);
select tests.rows('select * from public.teacher_courses where id in (' || quote_literal(:c1) || ',' || quote_literal(:c4) || ')', 2, 'the teacher now sees their new courses on their own list');
select tests.reset();

-- ===== Accepting twice does nothing more =====
select tests.server();
update public.courses set teacher_id = :t1 where id = :c4;
select tests.reset();
select tests.login(:t2);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select teacher_id from public.courses where id = :c4), :t1::uuid, 'a second acceptance does not take the course back');
select tests.reset();

-- ===== A student never gets a course from a row =====
select tests.login(:s2);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select status::text from public.profiles where id = :s2), 'active', 'the invited student is activated as before');
select tests.is((select teacher_id from public.courses where id = :c4), :t1::uuid, 'and no course is handed to a student');
select tests.reset();

-- ===== The choice goes with the invitation =====
select tests.server();
update public.profiles set status = 'pending' where id = :t2;
insert into public.invited_courses (user_id, course_id) values (:t2, :c2);
delete from public.profiles where id = :t2;
select tests.is((select count(*)::int from public.invited_courses where user_id = :t2), 0, 'withdrawing an invitation removes the choice');
select tests.reset();

-- ===== A course that is deleted takes its place on the list with it =====
select tests.server();
insert into public.invited_courses (user_id, course_id) values (:s1, :c4);
delete from public.courses where id = :c4;
select tests.is((select count(*)::int from public.invited_courses where course_id = :c4), 0, 'a deleted course leaves the list');
select tests.reset();

rollback;

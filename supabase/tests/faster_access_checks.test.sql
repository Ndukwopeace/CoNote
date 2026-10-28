-- Faster access checks (D121): the rules for who may read what are the same as before, but the
-- checks that depend on the signed-in person are worked out once per request instead of once per
-- row. These tests keep the rules and keep the speed-up from being undone by a later policy.
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

-- ===== The two sets of course IDs =====
select tests.login(:s1);
select tests.is((select array_agg(id order by id) from app.enrolled_course_ids() id), array[:c1]::uuid[], 'a student is enrolled in exactly their own course');
select tests.rows('select * from app.taught_course_ids()', 0, 'a student teaches nothing');
select tests.reset();
select tests.login(:s2);
select tests.rows('select * from app.enrolled_course_ids()', 0, 'a student in no course has an empty set');
select tests.reset();
select tests.login(:t1);
select tests.is((select array_agg(id order by id) from app.taught_course_ids() id), array[:c1]::uuid[], 'a teacher teaches their live course, and the archived one is left out');
select tests.rows('select * from app.enrolled_course_ids()', 0, 'a teacher is enrolled in nothing');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from app.enrolled_course_ids()', 0, 'an administrator is enrolled in nothing');
select tests.rows('select * from app.taught_course_ids()', 0, 'and teaches nothing');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from app.enrolled_course_ids()', 'a visitor cannot ask which courses are theirs');
select tests.denied('select * from app.taught_course_ids()', 'nor which they teach');
select tests.reset();

-- A suspended student and an archived course give nothing, as with the single-course checks.
select tests.server();
update public.profiles set status = 'suspended' where id = :s1;
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from app.enrolled_course_ids()', 0, 'a suspended student is enrolled in nothing');
select tests.rows('select * from public.class_sessions', 0, 'and reads no classes');
select tests.reset();
select tests.server();
update public.profiles set status = 'active' where id = :s1;
update public.courses set archived_at = now() where id = :c1;
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from app.enrolled_course_ids()', 0, 'an archived course is not in the set');
select tests.rows('select * from public.courses', 0, 'and is not readable');
select tests.reset();
select tests.server();
update public.courses set archived_at = null where id = :c1;
select tests.reset();

-- ===== The results are the same as the single-course checks gave =====
select tests.login(:s1);
select tests.rows('select * from public.class_sessions', 2, 'a student reads the two classes of their course');
select tests.rows('select * from public.class_sessions where course_id = ' || quote_literal(:c2), 0, 'and none of another course');
select tests.rows('select * from public.courses', 1, 'a student reads only their course');
select tests.rows('select * from public.summaries', 1, 'and only its published summary');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.class_sessions', 2, 'a teacher reads their course''s classes');
select tests.rows('select * from public.courses', 1, 'and only their live course');
select tests.rows('select * from public.enrollments', 1, 'and its enrolments');
select tests.rows('select * from public.summaries', 2, 'and its summaries, drafts included');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.class_sessions', 3, 'an administrator reads every class');
select tests.rows('select * from public.courses', 4, 'and every course');
select tests.reset();

-- ===== The checks are not repeated for every row =====
-- A policy that calls a per-course helper with a column makes the database run it once per row,
-- which made class lists slow. The listed tables must use the sets above instead.
select tests.is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('class_sessions', 'courses', 'enrollments', 'resources', 'summaries')
      and coalesce(qual, '') ~ 'app\.(is_enrolled|teaches)\('),
  0,
  'no read policy on the busy tables calls a helper for each row');
select tests.is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      -- A wrapped call reads "SELECT app.is_admin() AS ..."; a bare one has no SELECT before it.
      and (coalesce(qual, '') ~ '(?<!SELECT )app\.is_admin\(\)'
        or coalesce(with_check, '') ~ '(?<!SELECT )app\.is_admin\(\)')),
  0,
  'the administrator check is worked out once, inside a select');
select tests.is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.uid\(\)'
        or coalesce(with_check, '') ~ '(?<!SELECT )auth\.uid\(\)')),
  0,
  'the signed-in person is looked up once, inside a select');

-- ===== Nothing else changed: writing is as closed as before =====
select tests.login(:s1);
select tests.affects('update public.class_sessions set title = ''x''', 0, 'a student still cannot edit a class');
select tests.affects('update public.courses set title = ''x''', 0, 'nor a course');
select tests.reset();
select tests.login(:t1);
select tests.affects('update public.courses set title = ''x''', 0, 'a teacher still cannot edit a course');
select tests.reset();
rollback;

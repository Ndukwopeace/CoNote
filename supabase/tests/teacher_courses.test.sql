-- The teacher portal's course lists (D88).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set t2 '''00000000-0000-0000-0000-0000000000b2'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''

-- ===== A teacher sees their own live courses, with the counts =====
select tests.login(:t1);
select tests.rows('select * from public.teacher_courses', 1, 'teacher 1 sees MTH 202 only (the archived course is left out)');
select tests.is((select class_count from public.teacher_courses where id = :c1), 2, 'classes are counted');
select tests.is((select waiting_for_review_count from public.teacher_courses where id = :c1), 1, 'summaries in review are counted');
select tests.rows('select * from public.teacher_classes', 2, 'teacher 1 sees both classes of the course');
select tests.is((select note_count from public.teacher_classes where id = :k1), 1, 'notes are counted');
select tests.is((select summary_status::text from public.teacher_classes where id = :k1), 'published', 'the summary stage comes with the class');
select tests.is((select summary_status::text from public.teacher_classes where id = :k3), 'in_review', 'a draft shows its stage');
-- SECURITY: the view carries a count, never the note text.
select tests.rows('select content_html from public.notes', 0, 'a teacher still cannot read notes');
select tests.reset();

-- ===== Everyone else sees nothing =====
select tests.login(:t2);
select tests.is((select count(*) from public.teacher_courses where id = :c1), 0::bigint, 'another teacher does not see this course');
select tests.is((select count(*) from public.teacher_classes where course_id = :c1), 0::bigint, 'nor its classes');
select tests.reset();
select tests.login(:admin);
select tests.rows('select * from public.teacher_courses', 0, 'an administrator sees none');
select tests.rows('select * from public.teacher_classes', 0, 'nor classes');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.teacher_courses', 0, 'a student sees none');
select tests.rows('select * from public.teacher_classes', 0, 'nor classes');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.teacher_courses', 'a visitor reads nothing');
select tests.denied('select * from public.teacher_classes', 'a visitor reads no classes');
select tests.reset();

-- ===== Archived classes drop out of the list and the counts =====
select tests.server();
update public.class_sessions set archived_at = now() where id = :k3;
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.teacher_classes', 1, 'an archived class is left out');
select tests.is((select class_count from public.teacher_courses where id = :c1), 1, 'and not counted');
select tests.is((select waiting_for_review_count from public.teacher_courses where id = :c1), 0, 'its draft no longer waits');
select tests.reset();

rollback;

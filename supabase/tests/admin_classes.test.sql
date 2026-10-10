-- The admin console's class list (D85).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k3 '''00000000-0000-0000-0000-00000000d003'''
\set k2 '''00000000-0000-0000-0000-00000000d002'''

-- ===== The list belongs to administrators =====
select tests.login(:admin);
select tests.rows('select * from public.admin_classes', 3, 'admin sees every class');
select tests.is((select course_code from public.admin_classes where id = :k1), 'MTH 202', 'the course code comes with the class');
select tests.is((select note_count from public.admin_classes where id = :k1), 1, 'notes are counted');
select tests.is((select student_count from public.admin_classes where id = :k1), 1, 'students are counted');
select tests.is((select summary_status::text from public.admin_classes where id = :k1), 'published', 'the summary stage comes with the class');
select tests.is((select summary_status::text from public.admin_classes where id = :k3), 'in_review', 'a draft in review shows its stage only');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.admin_classes', 0, 'a teacher sees none');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.admin_classes', 0, 'a student sees none');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_classes', 'a visitor reads nothing');
select tests.reset();

-- A class without a summary has no stage.
select tests.server();
insert into public.class_sessions (course_id, title, starts_at, ends_at)
  values ('00000000-0000-0000-0000-00000000c004', 'Bare', now(), now() + interval '1 hour');
select tests.reset();
select tests.login(:admin);
select tests.is((select summary_status::text from public.admin_classes where title = 'Bare'), null, 'a class without a summary has no stage');
select tests.reset();

-- ===== Jobs record when they were queued =====
select tests.server();
insert into public.ai_jobs (class_id, course_id, status, attempt)
  values (:k1, '00000000-0000-0000-0000-00000000c001', 'failed', 1);
select tests.reset();
select tests.login(:admin);
select tests.rows('select created_at from public.ai_jobs where created_at <= now()', 1, 'a job has a creation time');
select tests.reset();

rollback;

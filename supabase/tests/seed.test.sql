-- The development seed loads cleanly and gives the demo accounts the right roles.
begin;
\i supabase/seed.sql
select tests.is((select count(*)::int from public.profiles), 7, 'seven demo accounts');
select tests.is((select status::text from public.profiles where email = 'suspended@conote.example'), 'suspended', 'one demo account is suspended');
select tests.is((select role::text from public.profiles where email = 'admin@conote.example'), 'admin', 'the demo admin is an admin');
select tests.is((select role::text from public.profiles where email = 'teacher@conote.example'), 'teacher', 'the demo teacher is a teacher');
select tests.is((select role::text from public.profiles where email = 'student@conote.example'), 'student', 'the demo student is a student');
select tests.is((select count(*)::int from public.enrollment_requests where status = 'pending'), 2, 'two requests wait');
-- The demo student reads their two courses and the one published summary.
select tests.login((select id from public.profiles where email = 'student@conote.example'));
select tests.rows('select * from public.courses', 2, 'the demo student sees two courses');
select tests.rows('select * from public.summaries', 1, 'the demo student sees one published summary');
-- The join dialog lists courses in use only: not the completed one, not the archived one.
select tests.rows('select * from public.joinable_courses', 4, 'the demo student can look at four courses to join');
select tests.is((select student_count from public.course_student_counts where course_id = '20000000-0000-0000-0000-000000000001'), 2, 'MTH 202 has two students');
select tests.rows('select * from public.notifications', 3, 'the demo student has three notifications');
select tests.rows('select * from public.notifications where not read', 2, 'two of them are unread');
select tests.reset();
rollback;

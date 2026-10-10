-- Demo data for local development, mirroring the apps' demo accounts (docs/CONFIG_FILES.md).
-- Loaded by `supabase db reset`. NEVER run against a hosted project: every account here has the
-- well-known demo password.

-- Logins. The sign-up trigger gives each a profile; staff are promoted below. The password is the
-- apps' demo password; Supabase stores only its hash.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       extensions.crypt('password1', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name), now(), now()
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'admin@conote.example', 'Amara Okafor'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'teacher@conote.example', 'Sarah Mbarga'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'smith@conote.example', 'Dr. Smith'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'student@conote.example', 'Victory Eze'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'ada@conote.example', 'Ada Obi'),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'tunde@conote.example', 'Tunde Bello'),
  ('10000000-0000-0000-0000-000000000007'::uuid, 'suspended@conote.example', 'Sam Suspended')
) as demo (id, email, full_name);

-- Roles and numbers, set by the server (here, the seed) and never by a browser.
update public.profiles set role = 'admin', staff_number = 'S-0001' where email = 'admin@conote.example';
update public.profiles set role = 'teacher', staff_number = 'S-0002', department = 'Mathematics' where email = 'teacher@conote.example';
update public.profiles set role = 'teacher', staff_number = 'S-0003', department = 'Computing' where email = 'smith@conote.example';
update public.profiles set student_number = 'U2023/5001', department = 'Computer Science' where email = 'student@conote.example';
update public.profiles set student_number = 'U2023/5002' where email = 'ada@conote.example';
update public.profiles set student_number = 'U2023/5003' where email = 'tunde@conote.example';
-- A suspended student, for the sign-in tests: the right password, but the account may not sign in.
update public.profiles set status = 'suspended' where email = 'suspended@conote.example';

-- Courses: Sarah teaches MTH 202, Dr. Smith teaches SWE 311, PHY 101 has no teacher yet.
insert into public.courses (id, code, title, department, teacher_id, status) values
  ('20000000-0000-0000-0000-000000000001', 'MTH 202', 'Linear Algebra', 'Mathematics', '10000000-0000-0000-0000-000000000002', 'ongoing'),
  ('20000000-0000-0000-0000-000000000002', 'SWE 311', 'Software Engineering', 'Computing', '10000000-0000-0000-0000-000000000003', 'ongoing'),
  ('20000000-0000-0000-0000-000000000003', 'PHY 101', 'Physics', 'Physics', null, 'upcoming');

-- The demo student is in both ongoing courses; Ada is in MTH 202 only.
insert into public.enrollments (course_id, student_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005');

-- Classes, dated around now so there is always something recent.
insert into public.class_sessions (id, course_id, number, title, starts_at, ends_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'Vectors', now() - interval '9 days', now() - interval '9 days' + interval '1 hour'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'Matrices', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 1, 'Software Requirements', now() - interval '5 days', now() - interval '5 days' + interval '1 hour');

-- Notes by the demo student.
insert into public.notes (student_id, course_id, class_id, title, content_html, tags) values
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Vector basics', '<p>Vectors have a magnitude and a direction.</p>', '{definition}'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Requirements', '<p>Functional vs non-functional.</p>', '{important}');

-- Summaries: one published, one waiting for Sarah's review.
insert into public.summaries (class_id, course_id, status, overview, notes_analyzed_count, students_analyzed_count, in_review_since, published_at, reviewed_by)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'published', 'Vectors have magnitude and direction.', 2, 2, null, now() - interval '8 days', '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'in_review', 'Matrices represent linear maps.', 2, 2, now() - interval '30 hours', null, null);

-- Requests to join: Tunde asks for MTH 202 and PHY 101.
insert into public.enrollment_requests (course_id, student_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006');

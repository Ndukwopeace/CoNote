-- A small school used by every test. IDs are fixed so the tests can name them.

create function tests.seed() returns void language plpgsql as $$
begin
  -- Logins. The trigger gives each a student profile; staff are then promoted below.
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-0000000000a1', 'admin@x.test'),
    ('00000000-0000-0000-0000-0000000000b1', 'teacher1@x.test'),
    ('00000000-0000-0000-0000-0000000000b2', 'teacher2@x.test'),
    ('00000000-0000-0000-0000-0000000000c1', 'student1@x.test'),
    ('00000000-0000-0000-0000-0000000000c2', 'student2@x.test');
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
  update public.profiles set role = 'teacher' where id in
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
  -- Courses: C1 (teacher 1), C2 (teacher 2), C3 (teacher 1, archived), C4 (no teacher, completed).
  insert into public.courses (id, code, title, teacher_id, status, archived_at) values
    ('00000000-0000-0000-0000-00000000c001', 'MTH 202', 'Linear Algebra', '00000000-0000-0000-0000-0000000000b1', 'ongoing', null),
    ('00000000-0000-0000-0000-00000000c002', 'PHY 101', 'Physics', '00000000-0000-0000-0000-0000000000b2', 'ongoing', null),
    ('00000000-0000-0000-0000-00000000c003', 'OLD 100', 'Old', '00000000-0000-0000-0000-0000000000b1', 'completed', now()),
    ('00000000-0000-0000-0000-00000000c004', 'MTH 101', 'Done', null, 'completed', null);
  -- Student 1 is in C1 only; student 2 is in nothing.
  insert into public.enrollments (course_id, student_id) values
    ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000c1');
  -- Classes: K1 and K3 in C1, K2 in C2.
  insert into public.class_sessions (id, course_id, number, title, starts_at, ends_at) values
    ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 1, 'Vectors', now() - interval '3 days', now() - interval '3 days' + interval '1 hour'),
    ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c002', 1, 'Motion', now() - interval '3 days', now() - interval '3 days' + interval '1 hour'),
    ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000c001', 2, 'Matrices', now() - interval '1 day', now() - interval '1 day' + interval '1 hour');
  -- A note by student 1.
  insert into public.notes (id, student_id, course_id, class_id, title, content_html) values
    ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000c1',
     '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Mine', '<p>secret</p>');
  -- Summaries: K1 published, K3 in review (a draft), K2 in review in the other teacher's course.
  insert into public.summaries (id, class_id, course_id, status, overview, published_at, in_review_since) values
    ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 'published', 'Public text', now(), null),
    ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000c001', 'in_review', 'Draft text', null, now()),
    ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c002', 'in_review', 'Other draft', null, now());
end $$;

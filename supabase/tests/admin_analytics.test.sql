-- D124: the administrator's Analytics page reads two functions that count. Only an administrator may
-- call them, the figures follow the period asked for, and nothing they return names a student.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''
\set k9 '''00000000-0000-0000-0000-00000000d009'''

-- A class this week with two students enrolled in its course; one of them writes two notes, the
-- other none. A second class a year ago, whose notes must stay out of this week's figures.
select tests.server();
insert into public.enrollments (course_id, student_id) values (:c1, :s1), (:c1, :s2) on conflict do nothing;
insert into public.class_sessions (id, course_id, number, title, starts_at, ends_at) values
  (:k9, :c1, 40, 'This week', now() - interval '2 days', now() - interval '2 days' + interval '1 hour')
  on conflict do nothing;
insert into public.notes (student_id, course_id, class_id, title, created_at) values
  (:s1, :c1, :k9, 'one', now() - interval '2 days'),
  (:s1, :c1, :k9, 'two', now() - interval '2 days'),
  (:s1, :c1, :k1, 'old', now() - interval '400 days');
select tests.reset();

-- ===== The figures =====
select tests.login(:admin);
select tests.is((select notes_created from public.admin_analytics(now() - interval '3 days', now() - interval '1 day')), 2, 'only notes written inside the period are counted');
select tests.is((select students_who_wrote from public.admin_analytics(now() - interval '3 days', now() - interval '1 day')), 1, 'a student who wrote twice counts once');
select tests.is((select students_expected from public.admin_analytics(now() - interval '3 days', now() - interval '1 day')) >= 2, true, 'students enrolled in a course with a class in the period are expected to write');
select tests.is((select students_who_wrote from public.admin_analytics(now() - interval '500 days', now() - interval '300 days')), 1, 'an earlier period counts its own notes');
select tests.is((select students from public.admin_analytics(now() - interval '7 days', now())), 2, 'students are counted by role');
select tests.is((select courses from public.admin_analytics(now() - interval '7 days', now())), 3, 'archived courses are left out');
select tests.server();
update public.profiles set last_active_at = now() - interval '3 days' where id = :s1;
update public.profiles set last_active_at = now() - interval '20 days' where id = :s2;
select tests.login(:admin);
select tests.is((select active_7 from public.admin_analytics(now() - interval '7 days', now())) >= 1, true, 'a student who signed in 3 days ago is active this week');
select tests.is((select active_30 - active_7 from public.admin_analytics(now() - interval '7 days', now())) >= 1, true, 'a student who signed in 20 days ago is active this month only');
select tests.is((select active_7 from public.admin_analytics(now() - interval '7 days', now(), now() + interval '60 days')), 0, 'the windows count back from the moment given');
select tests.fails_with('select * from public.admin_analytics(now(), now() - interval ''1 day'')', '22023', 'a period that ends before it starts is refused');
select tests.fails_with('select * from public.admin_analytics(null, now())', '22023', 'a missing date is refused');

-- ===== Class by class =====
select tests.is((select notes from public.admin_note_participation(now() - interval '3 days', now() - interval '1 day') where class_id = :k9), 2, 'a class lists its notes');
select tests.is((select writers from public.admin_note_participation(now() - interval '3 days', now() - interval '1 day') where class_id = :k9), 1, 'and how many students wrote them');
select tests.is((select enrolled from public.admin_note_participation(now() - interval '3 days', now() - interval '1 day') where class_id = :k9) >= 2, true, 'and how many are enrolled');
select tests.rows('select * from public.admin_note_participation(now() - interval ''500 days'', now() - interval ''300 days'') where class_id = ' || quote_literal(:k9), 0, 'a class outside the period is left out');
select tests.reset();

-- ===== Who may ask =====
select tests.login(:t1);
select tests.denied('select * from public.admin_analytics(now() - interval ''7 days'', now())', 'a teacher cannot read the figures');
select tests.denied('select * from public.admin_note_participation(now() - interval ''7 days'', now())', 'a teacher cannot read the class table');
select tests.reset();
select tests.login(:s1);
select tests.denied('select * from public.admin_analytics(now() - interval ''7 days'', now())', 'a student cannot read the figures');
select tests.denied('select * from public.admin_note_participation(now() - interval ''7 days'', now())', 'a student cannot read the class table');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_analytics(now() - interval ''7 days'', now())', 'a visitor cannot read the figures');
select tests.denied('select * from public.admin_note_participation(now() - interval ''7 days'', now())', 'a visitor cannot read the class table');
select tests.reset();

rollback;

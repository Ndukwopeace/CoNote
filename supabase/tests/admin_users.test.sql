-- The admin console's user list, profile edits and the invitation hand-over (D86).
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''

-- ===== The list belongs to administrators =====
select tests.login(:admin);
select tests.rows('select * from public.admin_users', 5, 'admin sees every account');
select tests.is((select course_count from public.admin_users where id = :s1), 1, 'a student counts the courses they are in');
select tests.is((select course_count from public.admin_users where id = :t1), 1, 'a teacher counts only the courses in use they teach');
select tests.is((select cardinality(course_ids) from public.admin_users where id = :t1), 2, 'but the course filter knows the archived one too');
select tests.is((select course_count from public.admin_users where id = :admin), 0, 'an administrator has no courses');
select tests.reset();
select tests.login(:t1);
select tests.rows('select * from public.admin_users', 0, 'a teacher sees none');
select tests.reset();
select tests.login(:s1);
select tests.rows('select * from public.admin_users', 0, 'a student sees none');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.admin_users', 'a visitor reads nothing');
select tests.reset();

-- ===== Last activity follows the latest sign-in =====
update auth.users set last_sign_in_at = '2026-10-01T09:00:00Z' where id = :s1;
select tests.login(:admin);
select tests.is((select last_active_at from public.admin_users where id = :s1), '2026-10-01T09:00:00Z'::timestamptz, 'last activity is copied from the sign-in');
select tests.is((select last_active_at from public.admin_users where id = :s2), null, 'nobody who has not signed in has one');
select tests.reset();

-- ===== Editing a profile =====
select tests.login(:admin);
select tests.affects('select public.admin_update_profile(' || quote_literal(:s1) || ', ''Vic Eze'', ''English'', ''200 Level'', ''0803'', ''U2023/9999'', null)', 1, 'an administrator edits a profile');
select tests.is((select full_name from public.admin_users where id = :s1), 'Vic Eze', 'the change is saved');
select tests.is((select count(*)::int from public.audit_logs where action = 'user.updated' and entity_id = :s1), 1, 'the edit is audited');
select tests.fails_with('select public.admin_update_profile(' || quote_literal(:s2) || ', ''X'', null, null, null, ''U2023/9999'', null)', '23505', 'a student number is unique');
select tests.fails_with('select public.admin_update_profile(''00000000-0000-0000-0000-00000000ffff'', ''X'', null, null, null, null, null)', 'P0002', 'an unknown account is not found');
select tests.reset();
select tests.login(:t1);
select tests.denied('select public.admin_update_profile(' || quote_literal(:s1) || ', ''Hacked'', null, null, null, null, null)', 'a teacher cannot edit a profile');
select tests.reset();
select tests.login(:s1);
select tests.denied('select public.admin_update_profile(' || quote_literal(:s1) || ', ''Me'', null, null, null, ''U1'', null)', 'a student cannot edit their own numbers');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.admin_update_profile(' || quote_literal(:s1) || ', ''X'', null, null, null, null, null)', 'a visitor cannot edit a profile');
select tests.reset();

-- ===== Accepting an invitation =====
select tests.server();
update public.profiles set status = 'pending' where id = :s2;
select tests.reset();
-- Someone else's call changes nothing.
select tests.login(:s1);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select status::text from public.profiles where id = :s2), 'pending', 'it did not touch another account');
select tests.reset();
-- The invited person accepts.
select tests.login(:s2);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select status::text from public.profiles where id = :s2), 'active', 'accepting activates the account');
select tests.is((select count(*)::int from public.audit_logs where action = 'user.status_changed' and entity_id = :s2 and actor_id = :s2), 1, 'and records it as the account''s own change');
select tests.reset();
-- A suspended account stays suspended.
select tests.server();
update public.profiles set status = 'suspended' where id = :s2;
select tests.reset();
select tests.login(:s2);
select public.accept_invitation();
select tests.reset();
select tests.server();
select tests.is((select status::text from public.profiles where id = :s2), 'suspended', 'a suspension is never undone');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.accept_invitation()', 'a visitor cannot accept');
select tests.reset();

rollback;

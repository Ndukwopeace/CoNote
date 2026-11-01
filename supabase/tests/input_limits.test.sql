-- Size limits on what a signed-in person may store (security hardening). The app limits a tag to
-- 30 characters and a picture address to a sensible length, but a request that skips the app must
-- meet the same limits in the database.
begin;
select tests.seed();

\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set k1 '''00000000-0000-0000-0000-00000000d001'''

select tests.login(:s1);

-- ===== Tags: not only how many, but how long =====
select tests.affects('insert into public.notes (course_id, class_id, tags) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', array_fill(repeat(''t'', 30), array[10]))', 1, 'ten tags of 30 characters are allowed');
select tests.fails_with('insert into public.notes (course_id, class_id, tags) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', array[repeat(''t'', 100000)])', '23514', 'one enormous tag is refused');
select tests.fails_with('insert into public.notes (course_id, class_id, tags) values (' || quote_literal(:c1) || ', ' || quote_literal(:k1) || ', array_fill(repeat(''t'', 31), array[10]))', '23514', 'tags that together pass the app''s own limit are refused');

-- ===== Picture address: https already required, now also bounded =====
select tests.affects('update public.profiles set avatar_url = ''https://cdn.example/'' || repeat(''a'', 400) where id = ' || quote_literal(:s1), 1, 'a reasonable https address is allowed');
select tests.fails_with('update public.profiles set avatar_url = ''https://cdn.example/'' || repeat(''a'', 100000) where id = ' || quote_literal(:s1), '23514', 'an enormous picture address is refused');

select tests.reset();
rollback;

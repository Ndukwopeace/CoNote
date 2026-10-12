-- Ask AI's daily limit (D94): each student may ask a fixed number of questions a day, counted by
-- functions only the server can call.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set s2 '''00000000-0000-0000-0000-0000000000c2'''

-- ===== Nobody but the server may count or read =====
select tests.login(:s1);
select tests.denied('select public.take_chat_slot(' || quote_literal(:s1) || ')', 'a student cannot take a slot, even their own');
select tests.denied('select public.give_back_chat_slot(' || quote_literal(:s1) || ')', 'a student cannot give a slot back');
select tests.denied('select * from public.ai_chat_usage', 'a student cannot read the counts');
select tests.reset();
select tests.login(:t1);
select tests.denied('select public.take_chat_slot(' || quote_literal(:s1) || ')', 'a teacher cannot take a slot');
select tests.reset();
select tests.login(:admin);
select tests.denied('select public.take_chat_slot(' || quote_literal(:s1) || ')', 'an administrator cannot take a slot');
select tests.denied('select * from public.ai_chat_usage', 'an administrator cannot read the counts');
select tests.reset();
select tests.anonymous();
select tests.denied('select public.take_chat_slot(' || quote_literal(:s1) || ')', 'a visitor cannot take a slot');
select tests.reset();

-- ===== The limit =====
select tests.server();
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-12 09:00+00'), true, 'the first question is allowed');
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-12 10:00+00'), true, 'the second is allowed');
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-12 11:00+00'), true, 'the third is allowed');
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-12 12:00+00'), false, 'the fourth is refused');
select tests.is((select questions from public.ai_chat_usage where user_id = :s1 and day = '2026-10-12'), 3, 'a refusal is not counted');
select tests.is(public.take_chat_slot(:s2, 3, '2026-10-12 12:00+00'), true, 'another student has their own count');
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-13 00:00+00'), true, 'the next day starts again');
select tests.is(public.take_chat_slot(:s1, 0, '2026-10-14 00:00+00'), false, 'a limit of zero allows nothing');
select tests.is((select count(*) from public.ai_chat_usage where day = '2026-10-14'), 0::bigint, 'and records nothing');

-- ===== Giving a slot back (the model failed, so the question did not count) =====
select public.give_back_chat_slot(:s1, '2026-10-12 12:30+00');
select tests.is((select questions from public.ai_chat_usage where user_id = :s1 and day = '2026-10-12'), 2, 'a slot given back lowers the count');
select tests.is(public.take_chat_slot(:s1, 3, '2026-10-12 13:00+00'), true, 'and the question can be asked again');
select public.give_back_chat_slot(:s2, '2026-10-12 12:30+00');
select public.give_back_chat_slot(:s2, '2026-10-12 12:31+00');
select tests.is((select questions from public.ai_chat_usage where user_id = :s2 and day = '2026-10-12'), 0, 'the count never goes below zero');
select tests.reset();

rollback;

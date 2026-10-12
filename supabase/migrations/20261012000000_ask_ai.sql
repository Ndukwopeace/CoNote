-- Ask AI's daily limit (D94). Ask AI and the summary pipeline share one language-model key, and
-- the key has a daily allowance. Without a cap, one student asking without end could use it up
-- and stop summaries for everyone. Each student gets a fixed number of questions a day, counted
-- here, by functions only the server can call.

-- ---------------------------------------------------------------------------------------------
-- The count: one row per student per day. Closed by default (Row Level Security on, no policy),
-- and no one but the server may touch it.
-- ---------------------------------------------------------------------------------------------

create table public.ai_chat_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The day, in UTC, so the limit resets at the same moment for everyone.
  day date not null,
  questions integer not null default 0 check (questions >= 0),
  primary key (user_id, day)
);
alter table public.ai_chat_usage enable row level security;
revoke all on public.ai_chat_usage from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Take a slot for one question. True when the student is under the limit (the question is then
-- counted), false when the day's limit is used up (nothing is counted). One statement does the
-- check and the count, so two questions sent at once cannot both take the last slot.
-- ---------------------------------------------------------------------------------------------

create function public.take_chat_slot(p_user uuid, p_limit integer default 30, p_now timestamptz default now())
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  -- A limit below one allows nothing, and records nothing.
  if p_limit < 1 then
    return false;
  end if;
  insert into public.ai_chat_usage (user_id, day, questions)
    values (p_user, (p_now at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set questions = public.ai_chat_usage.questions + 1
      where public.ai_chat_usage.questions < p_limit
    returning questions into v_count;
  -- No row came back when the update's condition failed: the limit was already reached.
  return v_count is not null;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Give a slot back, for a question the model could not answer, so a failure on our side does not
-- cost the student one of their questions. The count never goes below zero.
-- ---------------------------------------------------------------------------------------------

create function public.give_back_chat_slot(p_user uuid, p_now timestamptz default now())
  returns void
  language sql security definer set search_path = public, pg_temp as $$
  update public.ai_chat_usage set questions = greatest(questions - 1, 0)
    where user_id = p_user and day = (p_now at time zone 'utc')::date
$$;

-- Only the server key may call them. SECURITY: a browser, however signed in, is refused, so no
-- one can raise their own limit, reset it, or spend another student's questions.
revoke all on function public.take_chat_slot(uuid, integer, timestamptz),
  public.give_back_chat_slot(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.take_chat_slot(uuid, integer, timestamptz),
  public.give_back_chat_slot(uuid, timestamptz) to service_role;

-- Feedback from people who use the app (D125): anyone signed in can send a short message, and an
-- administrator reads it. The table is closed to every browser; the three functions below are the
-- only way in. Feedback holds words only, never a note or a draft.

-- ---------------------------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Who sent it. The row stays when the account is deleted, with the sender blank.
  user_id uuid references public.profiles (id) on delete set null,
  -- The sender's role when they sent it, set by the database and never by the browser.
  role public.user_role not null,
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  -- An optional score from 1 (poor) to 5 (great).
  rating smallint check (rating between 1 and 5),
  -- The page the sender was on, as an address path without a query. Helps find a bug.
  page text check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

-- SECURITY: no policy and no grant, so no browser can read or change a row directly. A visitor
-- cannot plant feedback under another person's name, and one person cannot read another's.
alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Sending feedback
-- ---------------------------------------------------------------------------------------------

-- Stores one piece of feedback from the caller. At most ten in any 24 hours, so a script cannot
-- fill the table.
-- SECURITY: the sender and their role come from the session, not from the arguments, so nobody can
-- send as someone else or claim to be an administrator. Only an active account may send.
create function public.submit_feedback(
  p_kind text,
  p_message text,
  p_rating integer default null,
  p_page text default null
) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_role public.user_role := app."current_role"();
begin
  -- No session, or an account that is not active: refused.
  if v_user is null or v_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- The kind and the message must be usable; the table's checks say the same, but an error here
  -- is the one the apps already understand.
  if p_kind not in ('bug', 'idea', 'other') or char_length(btrim(coalesce(p_message, ''))) not between 1 and 2000 then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'invalid rating' using errcode = '22023';
  end if;
  -- Ten in a rolling day is plenty for a person and far too few for a script.
  if (select count(*) from public.feedback f
       where f.user_id = v_user and f.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'too much feedback' using errcode = '54000';
  end if;
  insert into public.feedback (user_id, role, kind, message, rating, page)
    values (v_user, v_role, p_kind, btrim(p_message), p_rating::smallint, left(p_page, 200));
end
$$;
revoke all on function public.submit_feedback(text, text, integer, text) from public, anon;
grant execute on function public.submit_feedback(text, text, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Reading and sorting feedback (administrators)
-- ---------------------------------------------------------------------------------------------

-- One page of feedback, newest first, with who sent it. `total_count` is the number of matches.
-- SECURITY: only an active administrator gets rows; everyone else is refused.
create function public.admin_list_feedback(
  p_status text default null,
  p_kind text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid,
  kind text,
  message text,
  rating smallint,
  page text,
  status text,
  created_at timestamptz,
  sender_name text,
  sender_email text,
  sender_role public.user_role,
  total_count bigint
)
  language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select f.id, f.kind, f.message, f.rating, f.page, f.status, f.created_at,
           p.full_name, p.email, f.role, count(*) over ()
      from public.feedback f
      left join public.profiles p on p.id = f.user_id
     where (p_status is null or f.status = p_status)
       and (p_kind is null or f.kind = p_kind)
     order by f.created_at desc, f.id
     limit v_limit offset v_offset;
end
$$;
revoke all on function public.admin_list_feedback(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_feedback(text, text, integer, integer) to authenticated, service_role;

-- Marks one piece of feedback new or read, and records who did it.
-- SECURITY: administrators only.
create function public.admin_set_feedback_status(p_id uuid, p_status text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('new', 'read') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  update public.feedback set status = p_status where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'admin', 'feedback.status_changed', 'feedback', p_id::text,
            jsonb_build_object('status', p_status));
end
$$;
revoke all on function public.admin_set_feedback_status(uuid, text) from public, anon;
grant execute on function public.admin_set_feedback_status(uuid, text) to authenticated, service_role;

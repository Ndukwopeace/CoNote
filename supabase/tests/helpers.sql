-- Small assertion helpers for the security tests. Each failure raises an exception, which stops
-- the run (psql is started with ON_ERROR_STOP).

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Acts as the signed-in user `uid`: the API role plus the JWT subject, for this transaction only.
create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

-- Acts as a signed-out visitor.
create function tests.anonymous() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

-- Acts as the server, which bypasses Row Level Security.
create function tests.server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';
end $$;

-- Back to the test runner (a superuser).
create function tests.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Fails unless the two values are equal.
create function tests.is(actual anyelement, expected anyelement, name text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL - %: expected %, got %', name, expected, actual;
  end if;
  raise notice 'ok - %', name;
end $$;

-- Fails unless the query returns exactly `n` rows.
create function tests.rows(query text, n bigint, name text) returns void language plpgsql as $$
declare got bigint;
begin
  execute 'select count(*) from (' || query || ') q' into got;
  if got <> n then
    raise exception 'FAIL - %: expected % rows, got %', name, n, got;
  end if;
  raise notice 'ok - %', name;
end $$;

-- Fails unless the statement is refused with a permission error (privilege, RLS or function check).
create function tests.denied(stmt text, name text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL - %: was allowed', name;
exception when insufficient_privilege then
  raise notice 'ok - %', name;
end $$;

-- Fails unless the statement is refused with the given SQLSTATE.
create function tests.fails_with(stmt text, state text, name text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL - %: was allowed', name;
exception when others then
  if sqlstate = state then
    raise notice 'ok - %', name;
  else
    raise exception 'FAIL - %: expected %, got % (%)', name, state, sqlstate, sqlerrm;
  end if;
end $$;

-- Fails unless the data-changing statement touches exactly `n` rows (Row Level Security hides rows silently).
create function tests.affects(stmt text, n bigint, name text) returns void language plpgsql as $$
declare got bigint;
begin
  execute stmt;
  get diagnostics got = row_count;
  if got <> n then
    raise exception 'FAIL - %: expected % rows changed, got %', name, n, got;
  end if;
  raise notice 'ok - %', name;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

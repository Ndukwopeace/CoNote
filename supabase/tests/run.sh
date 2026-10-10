#!/usr/bin/env bash
# Builds a throwaway database from the migrations and runs every *.test.sql against it.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/postgres supabase/tests/run.sh
# The user needs permission to create databases. The database is dropped at the end.
set -euo pipefail

# Where this script lives, so it works from any directory.
here="$(cd "$(dirname "$0")" && pwd)"
# The server to use; the test database is created next to the one in the URL.
base="${DATABASE_URL:?Set DATABASE_URL to a Postgres server you may create databases on}"
# A name no real project would use.
name="conote_test_$$"
# The URL of the throwaway database: same server, different database name.
test_url="${base%/*}/${name}"

# Always drop the throwaway database, even when a test fails.
cleanup() { psql "$base" -qc "drop database if exists ${name} with (force)" >/dev/null; }
trap cleanup EXIT

# Create it.
psql "$base" -qc "create database ${name}"
# Stand-ins for what Supabase provides, then the migrations in order, then the helpers.
psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$here/support.sql"
for migration in "$here"/../migrations/*.sql; do
  psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$here/helpers.sql" -f "$here/fixtures.sql"

# Run each test file; one failure stops everything with a non-zero exit.
for test in "$here"/*.test.sql; do
  echo "== $(basename "$test")"
  (cd "$here/../.." && psql "$test_url" -q -v ON_ERROR_STOP=1 -f "$test") 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;s/^psql:.*ERROR:  /ERROR: /p'
  # PIPESTATUS[0] is psql's own exit code, not sed's.
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then exit 1; fi
done
echo "All database tests passed."

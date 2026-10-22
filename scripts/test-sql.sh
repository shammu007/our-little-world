#!/usr/bin/env bash
# Runs the migration + authorization tests against a throwaway local PostgreSQL database.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-sql.sh
set -eo pipefail
DB=olw_test_$$
cd "$(dirname "$0")/.."
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_supabase_stubs.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/20261022000000_our_little_world.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -o /dev/null -f supabase/tests/10_authorization_test.sql 2>&1 | sed -e "s/^psql:[^ ]* NOTICE:  //"
echo "ALL SQL AUTHORIZATION TESTS PASSED"

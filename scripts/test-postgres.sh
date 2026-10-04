#!/usr/bin/env bash
# Fresh real PostgreSQL for integration tests; never touches the main local volume.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Docker is required for PostgreSQL tests' >&2; exit 1; }
mkdir -p .tools/postgres-tests
runtime=$(mktemp -d "$PWD/.tools/postgres-tests/run.XXXXXX")
project="gakusei-test-$(basename "$runtime" | tr '[:upper:].' '[:lower:]-')-$$"
export LOCAL_DB_NAME=gakusei_test LOCAL_DB_USER=gakusei_test
LOCAL_DB_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_hex(24))')
LOCAL_DB_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
export LOCAL_DB_PASSWORD LOCAL_DB_PORT
compose=(docker compose -p "$project" -f compose.local.yml)
cleanup() { "${compose[@]}" down -v >"$runtime/cleanup.log" 2>&1; }
trap cleanup EXIT
"${compose[@]}" up -d --wait >"$runtime/compose.log" 2>&1
"${compose[@]}" exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1"' >"$runtime/sql.log"
if [ "$#" -eq 0 ]; then set -- -Dskip.frontend=true test; fi
./mvnw "$@"

#!/usr/bin/env bash
# Generate the baseline (Init) migration safely, against a THROWAWAY
# Postgres — never touches any real database.
#
#   pnpm db:baseline
#
# TypeORM diffs the entities against the empty throwaway DB and emits a
# full-schema migration into src/migrations/. Review the SQL, then commit
# the entity + migration together.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-Init}"
CT="svbk-baseline-pg-$$"
PORT="${BASELINE_PG_PORT:-55432}"

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶  Starting throwaway Postgres ($CT) on :$PORT …"
docker run -d --name "$CT" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=svbk -p "$PORT:5432" \
  postgres:16-alpine >/dev/null

echo "▶  Waiting for it to accept connections …"
for i in $(seq 1 30); do
  if docker exec "$CT" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
  [ "$i" = "30" ] && { echo "✖  Postgres did not start"; exit 1; }
done

echo "▶  Generating migration src/migrations/$NAME …"
DB_HOST=localhost DB_PORT="$PORT" DB_USERNAME=postgres \
  DB_PASSWORD=postgres DB_NAME=svbk \
  pnpm --silent typeorm migration:generate "src/migrations/$NAME"

echo
echo "✔  Done. Review the generated SQL, then:"
echo "     git add src/migrations/ && git commit -m 'db: baseline migration'"

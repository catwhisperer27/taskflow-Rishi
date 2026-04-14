#!/bin/sh
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-taskflow}"
DB_PASSWORD="${DB_PASSWORD:-taskflow}"
DB_NAME="${DB_NAME:-taskflow}"

DSN="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

echo "Waiting for database..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>/dev/null; do
  sleep 1
done
echo "Database ready."

echo "Running migrations..."
# If a previous migration left the schema in a dirty state, force it past
# so the idempotent SQL can re-run cleanly.
DIRTY=$(psql "$DSN" -t -c \
  "SELECT dirty FROM schema_migrations ORDER BY version DESC LIMIT 1;" \
  2>/dev/null | tr -d ' ' || echo "false")

if [ "$DIRTY" = "t" ]; then
  echo "Dirty migration detected — forcing past dirty version..."
  DIRTY_VERSION=$(psql "$DSN" -t -c \
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;" \
    2>/dev/null | tr -d ' ')
  migrate -path /app/migrations -database "$DSN" force "$DIRTY_VERSION"
  echo "Forced to version $DIRTY_VERSION. Re-running up..."
fi

migrate -path /app/migrations -database "$DSN" up
echo "Migrations complete."

echo "Running seed (if users table is empty)..."
USER_COUNT=$(psql "$DSN" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  psql "$DSN" -f /app/migrations/seed.sql
  echo "Seed complete."
else
  echo "Skipping seed (data already present)."
fi

echo "Starting server..."
exec ./server

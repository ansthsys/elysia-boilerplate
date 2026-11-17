#!/usr/bin/env sh
# Starts the test database for the driver selected in src/db/dialect.ts and
# prints the matching DATABASE_URL. Used by CI, so switching drivers never
# requires editing the workflow. Databases come from docker-compose.yml.
#
#   DATABASE_URL=$(scripts/ci-database.sh)
set -eu

driver=$(sed -nE "s#^export \* from '\./dialects/([a-z]+)'.*#\1#p" src/db/dialect.ts)

case "$driver" in
  postgres)
    docker compose up -d --wait postgres >&2
    echo "postgresql://postgres:postgres@localhost:${POSTGRES_PORT:-5432}/app_test"
    ;;
  mysql)
    docker compose up -d --wait mysql >&2
    echo "mysql://root:mysql@localhost:${MYSQL_PORT:-3306}/app_test"
    ;;
  sqlite)
    echo "file:./data/test.db"
    ;;
  *)
    echo "Unknown database driver '$driver' in src/db/dialect.ts" >&2
    exit 1
    ;;
esac

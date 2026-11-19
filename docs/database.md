# Database

## Switching driver (PostgreSQL / MySQL / SQLite)

1. Change **one line** in `src/db/dialect.ts`:

   ```ts
   export * from './dialects/postgres'   // or './dialects/mysql' | './dialects/sqlite'
   ```
2. Update `DATABASE_URL` (`postgresql://…`, `mysql://…`, `file:./data/app.db`).
3. Run `bun db:generate --name init` if `drizzle/<driver>/` does not exist yet, then `bun db:migrate`.

CI follows the same line. `scripts/ci-database.sh` reads the driver from `src/db/dialect.ts`, starts the matching database from `docker-compose.yml` (none for SQLite), and sets `DATABASE_URL`. The workflow never needs editing.

**Why a line of code and not an environment variable?** Drizzle's query types are specific to each SQL dialect. Choosing the dialect in code keeps every query fully typed. Choosing it at runtime would turn `db` into a union of three types that cannot be called.

Everything dialect-specific lives in `src/db/dialects/*.ts`. Each file exports the same names, so schemas, repositories and services never change:

| Export                          | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `table`, `index`, `uniqueIndex` | `pgTable` / `mysqlTable` / `sqliteTable` and friends |
| `column.*` (see below)          | equivalent column types on every driver              |
| `connect(url, schema)`          | `{ db, ping, migrate, close }`                       |
| `dialect`                       | names used by drizzle-kit and Better Auth            |
| `AnyTable`                      | table type of the active dialect (used by factories) |

### Column builders

| Builder                 | PostgreSQL                              | MySQL              | SQLite                     |
| ----------------------- | --------------------------------------- | ------------------ | -------------------------- |
| `id(name?)`             | `varchar(36)` PK, app-generated UUID v7 | same               | `text(36)`                 |
| `foreignId(name)`       | `varchar(36)`                           | same               | `text(36)`                 |
| `string(name, length?)` | `varchar(length)`                       | same               | `text(length)`             |
| `text(name)`            | `text`                                  | `text`             | `text`                     |
| `boolean(name)`         | `boolean`                               | `tinyint(1)`       | `integer(mode: 'boolean')` |
| `integer(name)`         | `integer`                               | `int`              | `integer`                  |
| `timestamp(name)`       | `timestamptz(3)`                        | `datetime(3)`, UTC | `integer(timestamp_ms)`    |
| `date(name)`            | `date` **as string** (`YYYY-MM-DD`)     | same               | `text`                     |
| `time(name)`            | `time`                                  | `time`             | `text`                     |
| `json(name)`            | `jsonb`                                 | `json`             | `text(mode: 'json')`       |
| `enum(name, values)`    | `varchar(len)` + TS union               | same               | `text(len)` + TS union     |

- **Dates are strings, not `Date`.** `column.date()` uses `mode: 'string'` on PostgreSQL/MySQL and `text` on SQLite, so `2026-01-31` never shifts because of a timezone. `drizzle-typebox` exposes it as `string | null`; refine it with `t.String({ format: 'date' })` in the model (see `posts.publishedOn`). Eden parses the `date` format back into a `Date` on the client.
- **Enums are not native.** PostgreSQL native enums are not used because SQLite has none. `column.enum('disk', ['local', 's3'])` stores a varchar and narrows the TypeScript type; validate the allowed values in the model with `t.Union([t.Literal('local'), t.Literal('s3')])` when the field is writable.
- **Deliberately absent:** `decimal`, `bigint`, arrays. Their behaviour differs enough across drivers that a portable wrapper would be a lie; add them to all three dialects if your project needs them.

`test/conventions.test.ts` asserts that all three dialects expose the same column keys.

Rules that keep repository code portable:

- **App-generated ids.** IDs are UUID v7 from `src/db/id.ts`, not auto increment.
- **No `.returning()`.** MySQL does not support it. Insert, then read the row back with `findById`.
- **App-side timestamps.** Default timestamps are set by the app (`src/db/columns.ts`), not by the database.
- **Indexed columns are strings.** Unique or indexed columns use `column.string()`, because MySQL cannot index `TEXT`.
- **Portable search.** Case-insensitive search uses `lower(col) like …`, not the Postgres-only `ilike`.
- **Portable unique errors.** Repositories wrap writes in `guardUnique()` (`src/db/errors.ts`), which turns each driver's duplicate-key error into `UniqueConstraintError`. Services catch that and decide the user-facing error (409).

The full test suite passes on all three drivers.

## Migrations

| Command                         | Effect                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `bun db:generate --name <name>` | writes SQL to `drizzle/<driver>/` from schema changes                        |
| `bun db:migrate`                | applies pending migrations (also run by the test setup and the Docker image) |
| `bun db:studio`                 | opens Drizzle Studio                                                         |

`bun test` drops and recreates the test database on every run; see [testing.md](testing.md). Migrations in the Docker image run as `bun dist/db/migrate.js`.

## Factories & seeders

**Factories** (`src/db/factories/`) know how to build one valid row of fake data. Seeders and tests both use them.

```ts
postFactory.make({ title: 'Fixed' }) // object only, nothing inserted
await postFactory.create({ authorId, categoryId }) // insert one
await postFactory.createMany(10, { authorId, categoryId })
await userFactory.create({ role: 'admin' }) // through Better Auth, so the user can sign in
```

**Seeders** (`src/db/seeders/`) are one file per table:

- **Repeatable:** each seeder must be safe to run more than once, so it skips rows that already exist.
- **Ordered:** the run order is the order of the list in `seeders/index.ts`.
- **Development only:** seeding refuses to run with `NODE_ENV=production`.

```bash
bun db:seed                    # every seeder
bun db:seed users categories   # only these
```

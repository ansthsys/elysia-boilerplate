# Testing

`bun test` uses the database from `.env.test`.

## Test database lifecycle

`test/setup.ts` is preloaded through `bunfig.toml` and runs once per `bun test` invocation:

1. **Refuses to run** unless `NODE_ENV=test` and the database looks disposable — a name ending in `_test`, an in-memory SQLite database, or a file matching `test*.db`. A stray `.env` cannot wipe your development data.
2. **Drops and recreates** it (`provisioning.drop()` + `runMigrations`).
3. Closes the pool in `afterAll`.

Why drop at the start instead of cleaning up afterwards: a crashed run cannot leave a dirty database behind, and the next run is always fresh. Per-test truncation is not used — the suite shares one process and one database, so cleanup would race with the next test's factories.

No manual cleanup script exists: the start of the next `bun test` is the cleanup.

Tests create their own rows with factories, so they never depend on seeders or on each other.

## Eden Treaty: typed tests

```ts
import { actingAs, api, createCategory } from './helpers'

it('creates a post (201)', async () => {
	const { user, headers } = await actingAs('member') // new user + session cookie
	const category = await createCategory()

	const { data, error, status } = await api.api.posts.post(
		{ title: 'Hello Elysia', content: 'Typed from end to end.', categoryId: category.id },
		{ headers },
	)

	expect(status).toBe(201)
	expect(data?.data.author.id).toBe(user.id) // autocompleted from the response schema
})
```

- **No server.** `api = treaty(app)` calls `app.handle` directly, without a port.
- **Paths become properties.** `/api/posts/:id` → `api.api.posts({ id }).patch(body, { headers })`. Query strings go in `get({ query: { page: 2 } })`.
- **`data` vs `error`.** `error.status` and `error.value` are typed from `errorResponses(...)`, which now uses a different model per status:

  ```ts
  expect(error?.value.error.details).toEqual([{ field: 'categoryId', message: 'Category does not exist', location: 'body' }])
  ```
- **Dates are parsed.** Eden turns date strings into `Date` objects — including `format: 'date'` columns.
- **Multipart.** Eden builds `FormData` when the body contains a `File` (see `test/files.test.ts`).
- **Tests are type-checked too**, so an API change that breaks a test shows up in `bun run typecheck` before it runs.

## Helpers (`test/helpers.ts`)

| Helper                    | Does                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `api`                     | the Eden client                                                      |
| `actingAs(role?)`         | creates a user (`member`/`admin`) and signs in → `{ user, headers }` |
| `signIn(email, password)` | signs in through Better Auth → `{ cookie }`                          |
| `createCategory()`        | example factory shortcut                                             |

To send a request a typed client cannot produce (malformed JSON, wrong types, tampered signatures), use `app.handle(new Request(...))`. See `test/health.test.ts` and `test/files.test.ts`.

## What is covered

| File                                                   | Covers                                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories.test.ts`, `posts.test.ts`, `admin.test.ts` | routes: success paths, 401/403/404/409/422, validation details, pagination, ownership, date column and date filters                                               |
| `files.test.ts`                                        | upload, metadata, signed URL, tampered/expired signature, MIME/size rejection, ownership, admin delete; S3 driver test when `S3_ENDPOINT` is set                  |
| `mail.test.ts`                                         | queue → drain delivery, retry on provider failure, console formatting, cron endpoint secret                                                                       |
| `health.test.ts`                                       | health check, 404 and malformed-JSON envelopes                                                                                                                    |
| `error-handler.test.ts`                                | error classes, `throw status()`, unexpected errors and invalid responses → envelope                                                                               |
| `**conventions.test.ts**`                              | module layout, no schemas in controllers, `process.env` only in `env.ts`, dialect imports only in `src/db/dialects`, no `.returning()`, identical column builders |
| `**contracts.test.ts**`                                | response keys match the published model, including relation subsets                                                                                               |
| `**openapi.test.ts**`                                  | one model per status, per-status `$ref`s, 422 requires `details`, 429/500 on every route, auth paths                                                              |
| `**error-contract.test.ts**`                           | real error bodies validated with TypeBox against those models                                                                                                     |
| `security.test.ts`                                     | security headers on every response, `x-request-id` reuse and rejection                                                                                            |
| `env.test.ts`                                          | environment parsing, production defaults, rejected secrets (calls `loadEnv` directly)                                                                             |
| `migrate.test.ts`                                      | `db:migrate` refuses to create a missing database without `--create-db`                                                                                           |
| `feature-switches.test.ts`                             | `AUTH_*` switches, `FEATURE_DISABLED`, and docs that hide switched-off endpoints                                                                                  |

Feature switches are read once at startup. `feature-switches.test.ts` therefore runs `test/fixtures/feature-switches.ts` in a child process with different environment variables, and compares what that process reports. Use the same pattern for a new switch.

## Continuous integration

`.github/workflows/ci.yml` runs `lint`, `typecheck`, `build` + the gzip budget check, and `test` on every push to `main` and on every pull request, including Dependabot's updates. A second job builds the Docker image, runs the bundled migrator and curls `/health` from the container.

The test database matches the driver in `src/db/dialect.ts`. `scripts/ci-database.sh` starts it with `docker compose` and prints its `DATABASE_URL`. You can run the same script locally:

```bash
DATABASE_URL=$(scripts/ci-database.sh) bun test
```

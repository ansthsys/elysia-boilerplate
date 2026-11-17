# Testing

`bun test` uses the database from `.env.test`.

- **Setup:** `test/setup.ts` is preloaded through `bunfig.toml` and applies the migrations once.
- **Independent tests:** each test creates its own data with factories, so tests never depend on seeders or on each other.

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
- **`data` vs `error`.** `data` is set for 2xx responses, `error` for everything else. `error.status` and `error.value` are typed from the route's `errorResponses(...)`:

  ```ts
  expect(error?.value.error.details).toEqual([{ field: 'categoryId', message: 'Category does not exist', location: 'body' }])
  ```
- **Dates are parsed.** Eden turns date strings back into `Date` objects.
- **Tests are type-checked too** (`bun run typecheck`), so an API change that breaks a test shows up before it runs.

## Helpers (`test/helpers.ts`)

| Helper                    | Does                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `api`                     | the Eden client                                                      |
| `actingAs(role?)`         | creates a user (`member`/`admin`) and signs in → `{ user, headers }` |
| `signIn(email, password)` | signs in through Better Auth → `{ cookie }`                          |
| `createCategory()`        | example factory shortcut                                             |

To send a request a typed client cannot produce (malformed JSON, wrong types), use `app.handle(new Request(...))`. See `test/health.test.ts`.

## What is covered

| File                                                   | Covers                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `categories.test.ts`, `posts.test.ts`, `admin.test.ts` | routes: success paths, 401/403/404/409/422, validation details, pagination, ownership |
| `health.test.ts`                                       | health check, 404 and malformed-JSON envelopes                                        |
| `error-handler.test.ts`                                | error classes, `throw status()`, unexpected errors and invalid responses → envelope   |
| `security.test.ts`                                     | security headers on every response, `x-request-id` reuse and rejection                |
| `env.test.ts`                                          | environment parsing, production defaults, rejected secrets (calls `loadEnv` directly) |
| `migrate.test.ts`                                      | `db:migrate` refuses to create a missing database without `--create-db`               |
| `feature-switches.test.ts`                             | `AUTH_ENABLED` / `AUTH_ROLES_ENABLED` on and off                                      |

Feature switches are read once at startup. `feature-switches.test.ts` therefore runs `test/fixtures/feature-switches.ts` in a child process with different environment variables, and compares the HTTP statuses that process reports. Use the same pattern to test a new switch.

## Continuous integration

`.github/workflows/ci.yml` runs `lint`, `typecheck` and `test` on every push to `main` and on every pull request, including Dependabot's dependency updates.

The test database matches the driver in `src/db/dialect.ts`. `scripts/ci-database.sh` starts it with `docker compose` and prints its `DATABASE_URL`. You can run the same script locally:

```bash
DATABASE_URL=$(scripts/ci-database.sh) bun test
```

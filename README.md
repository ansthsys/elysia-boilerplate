# Elysia Boilerplate

A production-ready REST API for **Elysia v1.4 + Bun**: Better Auth, Drizzle (PostgreSQL / MySQL / SQLite), driver-based storage, a durable mail queue, and type safety from the database to the frontend.

Runs on **Docker**, a **conventional Bun server**, and **Vercel with the Bun runtime**. Every target uses one runtime, so there is one mental model and no adapter zoo.

**Quick links:** [Quick start](#quick-start) · [Choose your path](#choose-your-path) · [Configuration](#configuration) · [Frontend and typing](#frontend-and-typing) · [Deployment](#deployment) · [Docs](#docs)

## Why this template

- **Rules are executable.** `bun test` fails if a controller declares schemas, if `process.env` is read outside `src/config/env.ts`, if a dialect drifts, or if the documented error shape no longer matches the real body. Documentation cannot silently rot.
- **Capabilities are registries, not hardcoding.** Database drivers, storage disks, mail transports and auth features each have one switch and one place to add a new implementation.
- **AI-friendly by construction.** `AGENTS.md` plus one skill (`SKILL.md` + `references/`) tell an agent where files go and which patterns are mandatory; the tests enforce it.
- **Human-friendly defaults.** `bun install`, a database, and `bun dev`. Everything else is optional and documented below.

## What is inside

| Area              | What you get                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**  | Four-layer modules: controller (`index.ts`) → service → repository, plus a mandatory `model.ts`.                                             |
| **Type safety**   | Drizzle table → TypeBox schema → handler → Eden Treaty. No `any` in routes or tests.                                                         |
| **Auth**          | Better Auth (email/password, verification, reset) with one capability registry and guard macros: `auth`, `role`, `permission`.               |
| **Errors & docs** | One envelope, **one OpenAPI model per status** (422 lists fields; 401 never does), 429/500 always documented. Contract tests keep it honest. |
| **Database**      | One-line driver switch; portable column builders (`date`, `time`, `json`, portable `enum`); UUID v7 ids; no `.returning()`.                  |
| **Storage**       | Disk registry: `local` (signed URLs) and `s3` (Bun's built-in client: AWS, R2, MinIO).                                                       |
| **Email**         | Database-backed outbox: requests enqueue, a drain worker sends with retries; console fallback prints the full message.                       |
| **Testing**       | Eden Treaty tests against a real DB that is recreated per run, plus convention, contract and OpenAPI tests.                                  |
| **Deploy**        | Docker, single binary, Vercel (Bun runtime); migrations as a separate step.                                                                  |

## Requirements

- **Bun ≥ 1.3** (`Bun.S3Client` needs a recent 1.3+; the Docker image uses 1.3)
- **Docker** for the local databases and MinIO — optional if you bring your own
- PostgreSQL 13+ with the default driver (the test setup uses `DROP DATABASE … WITH (FORCE)`)

## Quick start

```bash
bun install
docker compose up -d postgres        # POSTGRES_PORT=5433 if 5432 is taken
cp .env.example .env                 # set BETTER_AUTH_SECRET: openssl rand -base64 32
cp .env.test.example .env.test
bun db:migrate                       # creates the database when missing
bun db:seed                          # admin@example.com / password123
bun dev                              # http://localhost:3000/docs
```

Try it:

```bash
curl -s localhost:3000/api/posts?limit=2

# sign in (admin) and create a post with the session cookie
curl -s -X POST localhost:3000/api/posts \
  -H 'content-type: application/json' \
  -b "$(curl -s -i -X POST localhost:3000/api/auth/sign-in/email \
        -H 'content-type: application/json' \
        -d '{"email":"admin@example.com","password":"password123"}' \
      | grep -i '^set-cookie' | sed 's/^[^:]*: //; s/;.*//' | paste -sd';' -)" \
  -d '{"title":"Hello","content":"From curl, with the session cookie.","categoryId":"<id>"}'
```

## Choose your path

| I want to…                             | Start here                                                                |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Start a new API                        | [Quick start](#quick-start), then [Project structure](#project-structure) |
| Add an endpoint or a feature           | [Add a feature](#add-a-feature) and the recipe in the skill               |
| Know which config is active            | [Configuration](#configuration) → **Defaults at a glance**                |
| Connect a frontend / use the API types | [Frontend and typing](#frontend-and-typing)                               |
| Deploy                                 | [Deployment](#deployment)                                                 |
| Let an AI agent work on it             | [Working with AI agents](#working-with-ai-agents)                         |

## Commands

| Command                              | Description                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `bun dev`                            | start with watch mode                                                       |
| `bun test`                           | run the suite against `.env.test` (the test DB is recreated first)          |
| `bun run typecheck` / `bun run lint` | TypeScript and Biome                                                        |
| `bun run build`                      | bundle the server and ops scripts into `dist/`                              |
| `bun db:generate --name <name>`      | write a migration for the active driver                                     |
| `bun db:migrate`                     | apply migrations (`--create-db` / `--no-create-db` for non-interactive use) |
| `bun db:seed [names...]`             | run all seeders or the named ones                                           |
| `bun db:studio`                      | open Drizzle Studio                                                         |
| `bun openapi:export`                 | write `openapi.json` without starting the server                            |

Two things CI does that are deliberately **not** npm scripts, to keep `package.json` small:

- **Bundle budget**: `bun run build && bun run scripts/build-size.ts` (fails above `BUNDLE_BUDGET_KB`, default 600 kB gzip).
- **Test database**: `scripts/ci-database.sh` starts the driver selected in `src/db/dialect.ts`.

## Project structure

```
src/
├── index.ts              entry: export default app + Bun listener (skipped on Vercel)
├── app.ts                composition root, exports `type App`
├── client.ts             type-only entry for frontends (Eden)
├── config/env.ts         every environment variable, validated once
├── core/                 errors, response helpers, pagination, shared params
├── shared/               contracts safe to import in a frontend (types + helpers)
├── lib/
│   ├── auth.ts           Better Auth instance
│   ├── auth-features.ts  auth capability registry (plugins + hidden paths)
│   ├── logger.ts         pino
│   ├── mailer.ts         transport: Resend or the console fallback
│   ├── storage.ts        disk registry (imported as #lib/storage)
│   └── storage/          local + s3 drivers, HMAC signing
├── emails/               one pure template per event (subject + text + html)
├── plugins/              error handler, auth routes/guards, logger, headers, rate limit, OpenAPI
├── db/
│   ├── dialect.ts        ← the database driver switch
│   ├── dialects/         postgres.ts, mysql.ts, sqlite.ts (identical surface)
│   ├── schema/           one file per table + relations.ts
│   ├── factories/        fake data builders (seeders + tests)
│   └── seeders/          one seeder per table
└── modules/<feature>/
    ├── index.ts          controller: HTTP only
    ├── model.ts          schemas: table-derived, composed, query filters, no-table shapes
    ├── service.ts        business rules & orchestration
    └── repository.ts     every ORM query of the module
test/                     Eden tests + convention/contract/OpenAPI tests + helpers
drizzle/<driver>/         migrations per driver
scripts/                  build-size, export-openapi, ci-database
docs/                     guides (see Docs map)
```

### The four layers (do not invent new folders)

| Layer           | Owns                                                                             | Must not                       |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------ |
| `index.ts`      | routes, guards, status codes, `ok()`/`paginated()`                               | declare schemas, contain rules |
| `model.ts`      | four sections: table-derived, composed responses, query filters, no-table shapes | contain logic                  |
| `service.ts`    | business rules, 404→403→422 order, calling other modules' **services**           | import `db` or Elysia          |
| `repository.ts` | every Drizzle query of the module                                                | decide user-facing errors      |

Where does a new file go? [docs/structure.md](docs/structure.md) is the single answer. If it is not in that table, it does not belong in the project.

## Response format

```jsonc
// success
{ "success": true, "data": { "id": "…", "title": "…" } }

// paginated
{ "success": true, "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3,
  "hasNextPage": true, "hasPrevPage": false, "nextPage": 2, "prevPage": null } }

// validation error (422): `details` is required and lists every invalid field
{ "success": false, "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "Title must be between 3 and 200 characters", "location": "body" }],
    "requestId": "0b6c…" } }

// 401: no `details`, `code` is pinned to UNAUTHORIZED
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required", "requestId": "…" } }
```

| Status | Model                     | `error.code`                      | `details`    |
| ------ | ------------------------- | --------------------------------- | ------------ |
| 400    | `BadRequestError`         | `BAD_REQUEST`                     | optional     |
| 401    | `UnauthorizedError`       | `UNAUTHORIZED`                    | —            |
| 403    | `ForbiddenError`          | `FORBIDDEN` or `FEATURE_DISABLED` | —            |
| 404    | `NotFoundError`           | `NOT_FOUND`                       | —            |
| 409    | `ConflictError`           | `CONFLICT`                        | optional     |
| 422    | `ValidationError`         | `VALIDATION_ERROR`                | **required** |
| 429    | `TooManyRequestsError`    | `TOO_MANY_REQUESTS`               | —            |
| 500    | `InternalServerError`     | `INTERNAL_SERVER_ERROR`           | —            |
| 503    | `ServiceUnavailableError` | `SERVICE_UNAVAILABLE`             | —            |

`/api/auth/*` is the only exception: it keeps Better Auth's own format and is tagged `Auth` in the docs.

## Configuration

Only **two** variables are required to boot: `DATABASE_URL` and `BETTER_AUTH_SECRET`. Everything else has a safe default.

### Defaults at a glance

| Capability                  | Default                                         | Change with                                                          |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Auth module                 | **on**                                          | `AUTH_ENABLED=false` → auth routes 404, guarded routes 401           |
| Roles / admin plugin        | **on**                                          | `AUTH_ROLES_ENABLED=false` → role routes 403 `FEATURE_DISABLED`      |
| Bearer sessions             | off                                             | `AUTH_BEARER_ENABLED=true`                                           |
| Sign-up endpoint            | **on**                                          | `AUTH_SIGN_UP_ENABLED=false` (seeders and tests keep working)        |
| Password reset              | **on**                                          | `AUTH_PASSWORD_RESET_ENABLED=false`                                  |
| Email verification required | off                                             | `AUTH_REQUIRE_EMAIL_VERIFICATION=true`                               |
| Rate limit                  | **on** (100/min per IP)                         | `RATE_LIMIT_ENABLED=false`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| API docs                    | **on** in dev, **off** in production            | `OPENAPI_ENABLED=true`                                               |
| Storage                     | `local` (`./storage`)                           | `STORAGE_DRIVER=s3` + `S3_*`                                         |
| Email transport             | **console** (prints text + html)                | `RESEND_API_KEY` + `EMAIL_FROM`                                      |
| Mail drain                  | interval 10s (server); scheduler for serverless | `CRON_SECRET` + scheduler URL                                        |
| Database driver             | PostgreSQL                                      | one line in `src/db/dialect.ts`                                      |

### Feature switches

| Variable                          | Default                        | Effect                                                                                    |
| --------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `AUTH_ENABLED`                    | `true`                         | `false`: `/api/auth/*` 404 and guarded routes 401; public routes keep working.            |
| `AUTH_ROLES_ENABLED`              | `true`                         | Without the admin plugin, `role`/`permission` routes fail closed with `FEATURE_DISABLED`. |
| `AUTH_BEARER_ENABLED`             | `false`                        | Sessions through `Authorization: Bearer`; the docs advertise it only when on.             |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false`                        | Block sign-in until verified.                                                             |
| `AUTH_SIGN_UP_ENABLED`            | `true`                         | Hide `POST /api/auth/sign-up/*` without disabling the server-side capability.             |
| `AUTH_PASSWORD_RESET_ENABLED`     | `true`                         | Hide request/reset password endpoints.                                                    |
| `RATE_LIMIT_ENABLED`              | `true`                         | Global per-IP limiter.                                                                    |
| `OPENAPI_ENABLED`                 | `true` (`false` in production) | Serve `/docs` and `/docs/json`.                                                           |
| `STORAGE_DRIVER`                  | `local`                        | `local` or `s3`.                                                                          |

Switched-off endpoints disappear from `/docs` too, so the spec never advertises a 404.

### Environment variables

| Variable                                                             | Default                                        | Notes                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                           | `development`                                  | `production` hides 500 messages, enables secure cookies and disables docs by default.                   |
| `HOST` / `PORT`                                                      | `0.0.0.0` / `3000`                             |                                                                                                         |
| `APP_NAME` / `APP_URL`                                               | `Elysia Boilerplate` / `http://localhost:3000` | `APP_URL` is used in emails and signed URLs.                                                            |
| `LOG_LEVEL`                                                          | `info`                                         | pino level.                                                                                             |
| `DATABASE_URL`                                                       | —                                              | **required**; must match `src/db/dialect.ts`.                                                           |
| `CORS_ORIGINS`                                                       | `http://localhost:5173`                        | comma separated, exact origins.                                                                         |
| `BETTER_AUTH_SECRET`                                                 | —                                              | **required**, 32+ chars; example values are rejected in production.                                     |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`                            | `100` / `60000`                                |                                                                                                         |
| `TRUST_PROXY`                                                        | `false`                                        | read the client IP from `X-Forwarded-For`; set `true` on Vercel or behind a proxy.                      |
| `RESEND_API_KEY`                                                     | —                                              | without it, every email is printed to the log (text **and** html).                                      |
| `EMAIL_FROM`                                                         | `Elysia Boilerplate <noreply@example.com>`     | sender used by the provider.                                                                            |
| `CRON_SECRET`                                                        | —                                              | required by the internal mail drain (your scheduler sends it as a Bearer token); empty hides the route. |
| `STORAGE_DRIVER`                                                     | `local`                                        | `local` or `s3`.                                                                                        |
| `STORAGE_LOCAL_PATH`                                                 | `./storage`                                    | root folder of the local driver.                                                                        |
| `STORAGE_PUBLIC_BASE_URL`                                            | `APP_URL`                                      | base URL for local signed URLs.                                                                         |
| `STORAGE_SIGNING_SECRET`                                             | `BETTER_AUTH_SECRET`                           | HMAC secret for local signed URLs.                                                                      |
| `STORAGE_MAX_FILE_SIZE`                                              | `5m`                                           | upload limit, e.g. `5m`, `500k`.                                                                        |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | —                                              | required when `STORAGE_DRIVER=s3`.                                                                      |
| `S3_ENDPOINT`                                                        | —                                              | set for R2/MinIO; empty for AWS.                                                                        |
| `S3_VIRTUAL_HOSTED_STYLE`                                            | `false`                                        | path-style by default (MinIO and most compatible servers).                                              |

## Storage

Storage is a **disk registry**, not a hardcoded client:

```ts
import { storage } from '#lib/storage'

const disk = storage.disk() // follows STORAGE_DRIVER
await disk.put('files/abc.png', file, { type: 'image/png' })
const url = await disk.signedUrl('files/abc.png', { expiresIn: 900 })
```

| Driver  | Bytes live in        | Download URL                              | Good for                            |
| ------- | -------------------- | ----------------------------------------- | ----------------------------------- |
| `local` | `STORAGE_LOCAL_PATH` | `/api/files/raw?key=…&exp=…&sig=…` (HMAC) | `bun dev`, Docker with a volume     |
| `s3`    | S3 / R2 / MinIO      | provider-presigned URL                    | Vercel, multi-instance, large files |

The `files` module is a working example: upload, metadata, signed URL, delete with ownership. Bytes never go into the database. Full guide: [docs/storage.md](docs/storage.md).

## Email

Requests never wait for an email provider:

```
feature service → MailService.queue → mail_outbox (DB) → drain → Resend | console
```

- Templates live in `src/emails/` as pure `(data) => { subject, text, html }` functions.
- Without `RESEND_API_KEY`, the console transport prints the whole message (text **and** html), so reset/verification links stay usable.
- Drain triggers: interval on a long-running server; on serverless, an external scheduler calls `/api/internal/mail/drain` with `CRON_SECRET` (no cron is shipped by default).
- Example: a member's post queues a review email to every admin; approval uses the existing `publishedOn` + `PATCH /api/posts/:id`.

Full guide: [docs/email.md](docs/email.md).

## Frontend and typing

The API exports two entries (see `exports` in `package.json`):

| Import                      | Contains                                                               | Runtime cost             |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| `elysia-boilerplate/client` | `type App` (Eden) and every shared **type**                            | none — type only         |
| `elysia-boilerplate/shared` | `ErrorCode`, `hasPermission`, `hasRole`, `roles`, pagination constants | small; never server code |

Pick the setup:

| Setup                                  | Types come from                            | Use when                                     |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| **Bun workspace monorepo**             | `treaty<App>`                              | backend + frontend in one repo (recommended) |
| **Side-by-side folders, no workspace** | `treaty<App>` via `tsconfig` paths         | quick start, two installs                    |
| **Separate repository, Eden**          | `treaty<App>`, backend as a dev dependency | independent deploys                          |
| **Separate repository, OpenAPI**       | generated `api.d.ts`                       | no backend dependency, or non-TS clients     |

Monorepo in three files:

```jsonc
// package.json (root)
{ "private": true, "workspaces": ["be", "fe"] }
```

```jsonc
// fe/package.json
{ "dependencies": { "elysia-boilerplate": "workspace:*", "@elysiajs/eden": "1.4.9" } }
```

```ts
// fe/src/lib/api.ts
import { treaty } from '@elysiajs/eden'
import type { App } from 'elysia-boilerplate/client'

export const api = treaty<App>('http://localhost:3000', { fetch: { credentials: 'include' } })
```

A workspace hoists **one** `elysia` copy, so both sides compare the same types. In a separate repository, the frontend must install the backend package (not only Eden) and use `moduleResolution: "bundler"`, because TypeScript resolves the backend's `#` aliases through its own `package.json#imports`. The full checklist — including the duplicate-Elysia fix — is in [docs/client.md](docs/client.md).

## Database

One line switches driver (query types stay fully typed):

```ts
// src/db/dialect.ts
export * from './dialects/postgres' // or './dialects/mysql' | './dialects/sqlite'
```

Then update `DATABASE_URL` and run `bun db:generate --name <name>` for that dialect. Portable rules: app-generated ids, no `.returning()`, `lower(col) like …` for search, and only the builders exported by `#db/dialect`. Details: [docs/database.md](docs/database.md).

## Testing

```bash
bun test
```

- `test/setup.ts` **drops and recreates** the test database on every run. It refuses to run unless `NODE_ENV=test` and the database name looks disposable (`*_test`, in-memory SQLite, or `test*.db`).
- Tests create their own rows; there is no shared fixture state.
- Beyond routes: `conventions.test.ts` (architecture), `contracts.test.ts` (response ↔ model), `openapi.test.ts` + `error-contract.test.ts` (documented ↔ real errors), `mail.test.ts` (queue/retry/drain endpoint).
- The S3 driver test runs only when `S3_ENDPOINT` and `S3_BUCKET` are set.

## Deployment

| Target                               | Status            | Notes                                                                                                                                  |
| ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker / long-running Bun server** | supported         | multi-stage image runs `dist/`; migrations are a separate release step                                                                 |
| **Single binary**                    | supported         | `bun build --compile`; mount a volume for `local` storage                                                                              |
| **Vercel (Bun runtime)**             | supported         | default export + `vercel.json`; `s3` storage, Postgres/MySQL over TCP, `TRUST_PROXY=true`, mail drained by a scheduler (`CRON_SECRET`) |
| **Cloudflare Workers / edge**        | **not supported** | workerd lacks Bun APIs; needs D1, R2, Web Crypto and an experimental adapter                                                           |

```bash
docker build -t api .
docker run --rm --env-file .env.production api bun dist/db/migrate.js --no-create-db
docker run -d --env-file .env.production -p 3000:3000 api
```

**Cold start:** a serverless cold start also evaluates the app (env validation, Better Auth, router). This template keeps that small — no listener on import, lazy DB connection, OpenAPI generation skipped when disabled — and the built bundle imports in ≈120 ms locally. `scripts/build-size.ts` is a regression guard for that weight, **not** a billing metric, and it has no effect on the artifact. Full checklist, Vercel variables and scaling: [docs/deployment.md](docs/deployment.md).

## Add a feature

The complete, copy-pasteable recipe is [references/new-feature.md](.agents/skills/elysia-boilerplate/references/new-feature.md). The short version:

1. **Read the recipe and `test/conventions.test.ts`** — they encode the rules.
2. **Table**: `src/db/schema/<feature>.ts`, export it, add relations, generate a migration for each dialect.
3. **Model**: `src/modules/<feature>/model.ts` with the four sections (table-derived, composed responses, query filters, no-table shapes).
4. **Repository → Service → Controller**: queries, then rules, then HTTP. Modules call other modules' **services**, never repositories.
5. **Wire it**: `.use(featureModule)` in `src/app.ts`, tag in `src/plugins/openapi.ts`, factory/seeder if useful.
6. **Test and verify**: `test/<feature>.test.ts` with `api` + `actingAs`, then

```bash
bun run typecheck && bun run lint && bun test
```

## Working with AI agents

The repository ships agent context; an assistant should read it before writing code.

- **`AGENTS.md`** (and `CLAUDE.md`): the always-loaded summary.
- **`.agents/skills/elysia-boilerplate`**: the single skill.
  - `references/new-feature.md` — step-by-step module recipe.
  - `references/auth.md` — Better Auth plugins, switches, roles.
  - `references/email.md` — mail queue, templates, drains.
- **`.agents/skills/elysiajs-v1`**: Elysia 1.x's own API.

Non-negotiables (also enforced by tests):

- No new top-level folders or ad-hoc file names. Use the four layers and [docs/structure.md](docs/structure.md).
- Schemas only in `model.ts`; no `t.*` in controllers.
- Services do not import `db` or Elysia; repositories do not throw user-facing errors.
- Email via `MailService.queue`; storage via `storage.disk()`; auth plugins via `src/lib/auth-features.ts`.
- `process.env` only in `src/config/env.ts`.
- Finish with `bun run typecheck && bun run lint && bun test`.

The skills are linked for Claude Code (`.claude/skills`), Command Code (`.commandcode/skills`), and any agent that reads `.agents/skills`.

## Docs

| Guide                                                        | Covers                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| [Structure](docs/structure.md)                               | where every file goes, the four model sections, adding a module |
| [Validation & errors](docs/validation-and-errors.md)         | envelope, one model per status, drizzle-typebox refinements     |
| [Database](docs/database.md)                                 | driver switch, portable columns, migrations, factories, seeders |
| [Auth](docs/auth.md)                                         | Better Auth, guards, roles, feature switches                    |
| [Storage](docs/storage.md)                                   | disks, local vs S3, MinIO, migrating between drivers            |
| [Email](docs/email.md)                                       | queue/outbox, templates, console fallback, drains, tests        |
| [Frontend & typing](docs/client.md)                          | monorepo, separate repo, Eden vs generated OpenAPI types        |
| [Testing](docs/testing.md)                                   | test DB lifecycle, Eden tests, convention/contract suites       |
| [Elysia concepts](docs/elysia-concepts.md)                   | macro, derive, resolve, guard, scope… and where each is used    |
| [Deployment](docs/deployment.md)                             | Docker, single binary, Vercel, cold start, scaling              |
| [Updating from the template](docs/updating-from-template.md) | pulling template fixes into a project created from it           |
| [Upgrading](docs/upgrading.md)                               | dependencies, the 1.1 checklist and the path to Elysia v2       |

## Troubleshooting

| Symptom                                           | Fix                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bun test` refuses to run                         | Set `NODE_ENV=test` and a disposable `DATABASE_URL` (`*_test`).                                                                         |
| `/docs` is 404                                    | Production disables it by default: `OPENAPI_ENABLED=true`.                                                                              |
| Email arrives nowhere                             | No `RESEND_API_KEY` → check the terminal (full message). On serverless, set `CRON_SECRET` and call the drain endpoint from a scheduler. |
| Vercel function fails to boot                     | Use PostgreSQL/MySQL (not `bun:sqlite`), `STORAGE_DRIVER=s3`, and `TRUST_PROXY=true`.                                                   |
| `treaty<App>` type error                          | Two `elysia` copies: use a workspace or the `paths` override in [docs/client.md](docs/client.md).                                       |
| `Cannot find module '#db/client'` in the frontend | Use `moduleResolution: "bundler"` (or `nodenext`).                                                                                      |
| Upload rejected with 422                          | Check the MIME whitelist in `src/modules/files/model.ts` and `STORAGE_MAX_FILE_SIZE`.                                                   |

## Not included

- `decimal`, `bigint` and array columns; native database enums.
- Cloudflare Workers and other edge runtimes.
- OAuth/social providers, 2FA/passkeys, organizations.
- A general-purpose job queue beyond the mail outbox; Redis-backed rate limiting; caching.
- Backups, log shipping, metrics/alerting, TLS, secrets management.
- Per-tenant permissions.

Each is a deliberate boundary, not an oversight.

## License

MIT

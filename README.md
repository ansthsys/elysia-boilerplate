# Elysia Boilerplate

Production-ready REST API boilerplate for **Elysia v1.4 + Bun**. It comes with Better Auth, Drizzle ORM, and type safety from the database all the way to the client.

The goal is a backend you can clone and extend by copying the existing examples, without having to rewire anything.

## Features

- **Elysia 1.4** with layered feature modules: controller (HTTP) → service (business logic) → repository (data access), plus a model file for schemas.
- **End-to-end type safety**: Drizzle table → TypeBox schema → handler → Eden Treaty. There is no `any` in routes or tests.
- **Better Auth**: email/password sign-in, email verification, password reset, rate limiting.
  - Optional plugins with on/off switches: **admin** (roles & permissions) and **bearer**.
- **Route guards as macros**: `auth: true`, `role: 'admin'`, `permission: { category: ['create'] }`.
- **One response envelope** for every success and every error:
  - Validation errors list each field with a readable message.
  - Custom error classes (`NotFoundError`, `ConflictError`, …) remove hand-written error responses.
- **Switch database driver in one line**: PostgreSQL, MySQL or SQLite. The test suite passes on all three.
- **Drizzle migrations** per driver. `bun db:migrate` offers to create a missing database, like Laravel.
- **A factory and a seeder per table**, reused by tests.
- **Documentation**: OpenAPI + Scalar at `/docs`, with Better Auth routes merged in.
- **Logging**: structured pino logs with a request id in every log line and error response.
- **Production defaults**:
  - security headers, rate limiting, CORS;
  - environment validated at startup, rejecting public example secrets;
  - API docs off in production unless enabled;
  - graceful shutdown, and migrations as a separate release step.
- **Tests** with Eden Treaty, plus Docker and Biome.
- **GitHub Actions CI** that tests whichever database driver is selected, with no workflow edits when you switch.

## Quick start

```bash
bun install
docker compose up -d postgres            # POSTGRES_PORT=5433 if 5432 is taken
cp .env.example .env                     # set BETTER_AUTH_SECRET (openssl rand -base64 32)
cp .env.test.example .env.test
bun db:migrate                           # offers to create the database if it does not exist
bun db:seed                              # admin@example.com / password123
bun dev                                  # http://localhost:3000/docs
```

| Command                              | Description                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `bun dev`                            | start with watch mode                                                                                             |
| `bun test`                           | run the test suite (uses `.env.test`)                                                                             |
| `bun run typecheck` / `bun run lint` | type check / lint & format check                                                                                  |
| `bun db:generate --name <name>`      | create a migration from schema changes                                                                            |
| `bun db:migrate`                     | apply migrations; asks before creating a missing database (`--create-db` / `--no-create-db` to skip the question) |
| `bun db:seed [names...]`             | run all seeders or the named ones                                                                                 |
| `bun db:studio`                      | open Drizzle Studio                                                                                               |
| `bun openapi:export`                 | write `openapi.json` without starting the server                                                                  |

## Project structure

```
src/
├── index.ts              process entry: listen + graceful shutdown
├── app.ts                composes plugins and modules, exports `type App`
├── client.ts             type-only entry for API consumers (Eden)
├── config/env.ts         every environment variable, validated at startup
├── core/                 building blocks shared by modules
│   ├── errors.ts         AppError + NotFoundError, ForbiddenError, ...
│   ├── http.ts           ok(), paginated(), errorResponses()
│   └── pagination.ts     ?page=&limit= query schema
├── shared/               contracts safe to import in a frontend
│   ├── errors.ts         error codes
│   ├── response.ts       response envelope schemas & types
│   ├── pagination.ts     pagination meta + helpers
│   └── permissions.ts    roles & permissions (Better Auth access control)
├── lib/                  third-party clients: auth (Better Auth), logger, mailer
├── plugins/              Elysia plugins: auth guard, error handler, request logger, security headers, rate limit, OpenAPI
├── db/
│   ├── dialect.ts        ← the database driver switch
│   ├── dialects/         postgres.ts, mysql.ts, sqlite.ts
│   ├── schema/           one file per table + relations.ts
│   ├── factories/        fake data builders (seeders + tests)
│   ├── seeders/          one seeder per table
│   ├── client.ts         the database connection
│   └── migrate.ts, seed.ts
└── modules/<feature>/
    ├── index.ts          controller: HTTP only (routes, schemas, guards, status codes)
    ├── model.ts          request/response schemas
    ├── service.ts        business rules & orchestration (no HTTP, no SQL)
    └── repository.ts     data access: every ORM query of the module
test/                     Eden Treaty tests + helpers (actingAs, signIn)
drizzle/<driver>/         migrations per database driver
scripts/                  export-openapi.ts, ci-database.sh (test database for CI)
docs/                     guides
```

Not sure where a new file goes? See [docs/structure.md](docs/structure.md).

## Response format

```jsonc
// success
{ "success": true, "data": { "id": "…", "title": "…" } }

// paginated
{ "success": true, "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3,
  "hasNextPage": true, "hasPrevPage": false, "nextPage": 2, "prevPage": null } }

// any error: validation, 401, 403, 404, 409, 429, 500
{ "success": false, "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "Title must be between 3 and 200 characters", "location": "body" }],
    "requestId": "0b6c…" } }
```

The only exception is `/api/auth/*`, which keeps Better Auth's own response format.

## Feature switches

| Variable                          | Default                        | Effect                                                                                        |
| --------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED`                    | `true`                         | `false`: `/api/auth/*` returns 404 and guarded routes return 401. Public routes keep working. |
| `AUTH_ROLES_ENABLED`              | `true`                         | Better Auth admin plugin. `false`: `role`/`permission` routes return 403 (fail closed).       |
| `AUTH_BEARER_ENABLED`             | `false`                        | Better Auth bearer plugin: sessions through the `Authorization` header.                       |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false`                        | Users must verify their email before signing in.                                              |
| `RATE_LIMIT_ENABLED`              | `true`                         | Per-IP rate limit. Set `TRUST_PROXY=true` behind a reverse proxy.                             |
| `OPENAPI_ENABLED`                 | `true` (`false` in production) | Serve `/docs` and `/docs/json`.                                                               |

## Guides

| Guide                                                        | Covers                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [Structure](docs/structure.md)                               | where files go; adding a module step by step                                  |
| [Validation & errors](docs/validation-and-errors.md)         | response envelope, error classes, drizzle-typebox refinements                 |
| [Database](docs/database.md)                                 | switching drivers, migrations, factories, seeders                             |
| [Auth](docs/auth.md)                                         | Better Auth, guard macros, roles & permissions, adding plugins                |
| [Testing](docs/testing.md)                                   | Eden Treaty tests                                                             |
| [Using the API from a frontend](docs/client.md)              | Eden in a `./be` + `./fe` layout, or types only for a separate repository     |
| [Elysia concepts](docs/elysia-concepts.md)                   | macro, derive, resolve, guard, scope… and where each is used                  |
| [Deployment](docs/deployment.md)                             | production checklist, migrations as a release step, scaling, security headers |
| [Updating from the template](docs/updating-from-template.md) | pulling template fixes into a project created from it (git + tags, no AI)     |
| [Upgrading](docs/upgrading.md)                               | dependency notes and the path to Elysia v2                                    |

## Working with AI agents

The template ships agent context, so an AI assistant follows its conventions:

- **`AGENTS.md`** (and `CLAUDE.md`): the rules, loaded automatically by most agents.
- **`.agents/skills/elysia-boilerplate`**: layers, pitfalls, and a step-by-step recipe for a new feature. The recipe is verified by building a full feature from it.
- **`.agents/skills/elysiajs-v1`**: Elysia 1.x's own API.

The skills are linked for Claude Code (`.claude/skills`), Command Code (`.commandcode/skills`), and OpenCode and other agents that read `.agents/skills`. To add your own skill, see [docs/upgrading.md](docs/upgrading.md#ai-agent-skills).

## License

MIT

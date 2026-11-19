# Changelog

All notable changes to this template. Versions follow [Semantic Versioning](https://semver.org):

| Bump      | Meaning                                       |
| --------- | --------------------------------------------- |
| **major** | a change that existing projects must adapt to |
| **minor** | a new feature or example                      |
| **patch** | a fix                                         |

Each entry lists the files that changed, so projects created from the template can apply them. See [docs/updating-from-template.md](docs/updating-from-template.md).

## [1.1.0] - 2026-11-19

Made the template answer the questions a real project asked: date columns, per-status error docs, storage, feature-level auth switches, a clean test database, a measured build and honest deployment docs.

### Added

- **Email queue (outbox)**: `mail_outbox` table, `MailService.queue`/`drain` (`src/modules/mail/`), retries with backoff, lease-based claiming and a hidden drain endpoint (`/api/internal/mail/drain`, `CRON_SECRET`).
  - Long-running servers drain on an interval; Vercel drains from the cron entry in `vercel.json`.
  - Feature example: a member's post queues a review email to every admin (`src/emails/post-pending-review.ts`); approval uses the existing `publishedOn` + `PATCH /api/posts/:id`.
  - Console transport prints the full message (text **and** html) when `RESEND_API_KEY` is missing, and logs the payload when the provider fails.
  - Migrations: `drizzle/*/0003_mail_outbox.sql`.
- **Focused references**: auth and email knowledge moved into `references/auth.md` and `references/email.md` inside the single `elysia-boilerplate` skill (no extra skill folders). `docs/email.md` documents the queue and the template rules.
- **Storage** (`src/lib/storage/`): a disk registry with two drivers behind one contract.
  - `local` (filesystem + HMAC signed URLs) and `s3` (`Bun.S3Client`: AWS S3, R2, MinIO).
  - `put` / `read` / `delete` / `exists` / `signedUrl`, plus optional `presignPut`.
  - New `files` module (`src/modules/files/`), table `src/db/schema/files.ts`, permissions `file:delete`, tests and `docs/storage.md`.
  - MinIO services in `docker-compose.yml` (`--profile s3`).
- **Portable column builders**: `column.date`, `column.time`, `column.json`, `column.enum` in all three dialects.
  - `posts.publishedOn` is a date-only example (`drizzle/postgres|mysql|sqlite/0002_post_published_on.sql`).
- **Date filters** on `GET /api/posts`: `createdAfter`, `createdBefore`.
- **Per-status error models** in `src/shared/response.ts` and `src/plugins/error-handler.ts`.
  - `FEATURE_DISABLED` code and `FeatureDisabledError` for switched-off capabilities.
- **Architecture tests**:
  - `test/conventions.test.ts` (layout, no schemas in controllers, no `process.env` outside `env.ts`, no dialect imports outside `src/db/dialects`, no `.returning()`, identical column surface);
  - `test/contracts.test.ts` (response keys vs. model, including relation subsets);
  - `test/openapi.test.ts` and `test/error-contract.test.ts` (documented vs. actual error shapes).
- **`test/setup.ts`** now drops and recreates the test database, guarded by `NODE_ENV=test` and a disposable-name check. No manual cleanup script is shipped: the start of every run handles it.
- **Build tooling**: `bun run build` bundles `src/index.ts`, `src/db/migrate.ts` and `src/db/seed.ts`. The gzip budget check lives in `scripts/build-size.ts` and runs in CI after the build — there is no `build:size` npm script.
- **`docs/storage.md`** and **`.env.production.example`**.
- **`src/core/schemas.ts`** (`idParams`) and `src/modules/{health,admin}/model.ts`, so every module now has a `model.ts`.

### Changed

- **Vercel ready (Bun runtime)**: `src/index.ts` exports the app as its default and only calls `listen` when `import.meta.main && !env.VERCEL`; `vercel.json` pins `bunVersion`. The rate limiter falls back to proxy headers outside a Bun listener, and README/deployment docs now state the supported targets (Docker, conventional Bun server, Vercel) and that Cloudflare/edge runtimes are not supported.
- `errorResponses(...)` resolves to a **different model per status** and always adds `429`/`500`. Response bodies are unchanged; OpenAPI and Eden types are more precise.
- **Import aliases**: `src/lib/storage.ts` is now a facade over `src/lib/storage/`, so `#lib/storage` resolves through `#*` like every other import and `package.json#imports` no longer needs a special entry.
- **Auth plugin registry**: `src/lib/auth-features.ts` now derives the Better Auth plugin array and the hidden `/api/auth/*` paths from one declarative list.
  - `plugins/auth.ts` and `plugins/openapi.ts` share `isAuthPathDisabled` from it, so runtime 404s and `/docs` cannot disagree.
  - Admin routes now return the standard 404 envelope when `AUTH_ROLES_ENABLED=false`.
  - `docs/auth.md` documents the registry, a plugin catalog, and the measured reason for not pre-registering unused plugins (≈207 kB gzip for the whole plugin barrel vs. 0 for the registry).
- `src/plugins/auth.ts`: bearer security is advertised only when `AUTH_BEARER_ENABLED=true`; disabled auth paths are filtered from `/docs`.
- `src/plugins/openapi.ts`: the production cookie name uses the `__Secure-` prefix; Better Auth schema generation is skipped when `OPENAPI_ENABLED=false`.
- `src/config/env.ts`: `STORAGE_*` and `S3_*` variables, and fail-fast validation for `STORAGE_DRIVER=s3`.
- `src/db/schema/relations.ts`: `files` relations.
- `Dockerfile`: multi-stage build, runs `dist/index.js`; migrations run as `bun dist/db/migrate.js`.
- `docker-compose.yml`: MinIO, `storage` volume, storage environment passthrough.
- `.github/workflows/ci.yml`: bundle budget check and an image job that builds, migrates and smoke-tests the bundle.
- `test/feature-switches.test.ts` + fixture: sign-up/password-reset switches, `FEATURE_DISABLED`, and docs filtering.
- `src/shared/pagination.ts`: removed the duplicate `PaginationQuery` interface (the Elysia one lives in `src/core/pagination.ts`).
- `src/modules/posts/model.ts`, `categories/model.ts`: shared `idParams`, date filters, `publishedOn` refinement.
- Docs: rewritten `README.md` and `docs/deployment.md`; updated `docs/auth.md`, `database.md`, `structure.md`, `validation-and-errors.md`, `testing.md`, `elysia-concepts.md`, `client.md`, `upgrading.md`; `AGENTS.md`, `CLAUDE.md` and the `elysia-boilerplate` skill.

### Breaking changes

1. **`errorResponses(...)`** now maps each status to its own model and adds `429`/`500`. Clients that hardcoded the `ErrorResponse` model name in generated OpenAPI types must regenerate.
2. **`FEATURE_DISABLED`** (403) is a new error code, returned when roles are switched off. Branch on `code`, not on the 403 status alone.
3. **Test database**: `bun test` drops and recreates it. It refuses to run unless `NODE_ENV=test` and the database name looks disposable.
4. **Env**: new `AUTH_SIGN_UP_ENABLED`, `AUTH_PASSWORD_RESET_ENABLED`, `STORAGE_*` and `S3_*` variables (all have defaults except the S3 credentials when `STORAGE_DRIVER=s3`).
5. **Docker**: the image runs `dist/`; the migration command is now `bun dist/db/migrate.js`.
6. **`bun db:test:drop` was removed.** The test suite recreates the database at the start of every run; no manual cleanup step is needed.

## [1.0.0] - 2026-11-17

First release.

- **Stack:** Elysia 1.4 + Bun REST API with layered modules (controller → service → repository).
- **Auth:** Better Auth with email/password.
  - Optional plugins: admin (roles & permissions) and bearer.
  - Guard macros: `auth`, `role`, `permission`.
- **Responses:** a standard envelope for success and errors, custom error classes, and field-level validation messages.
- **Database:** Drizzle with a one-line switch between PostgreSQL, MySQL and SQLite.
  - Migrations per driver; `db:migrate` offers to create a missing database.
  - Factories and seeders per table.
- **Docs & logging:** OpenAPI + Scalar with Better Auth routes merged in, and pino logs with a request id.
- **Production defaults:** security headers, rate limiting, environment validation, docs off in production, and migrations as a release step.
- **AI agents:** an `elysia-boilerplate` skill with the template's conventions and a verified new-feature recipe, plus Elysia v1/v2 skills, for Claude Code, OpenCode, Command Code and agents that read `.agents/skills`.
- **Quality:** Eden Treaty tests on all three drivers, CI that follows the selected driver, Docker, Dependabot and Biome.

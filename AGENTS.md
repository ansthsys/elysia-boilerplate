# Agent guide

Elysia **v1.4** REST API (Bun), created from the **elysia-boilerplate** template.

- **`elysia-boilerplate` skill** (`.agents/skills/elysia-boilerplate`): load it before adding or changing features, endpoints, tables, permissions, auth, email or tests. Details are in its `references/` folder (`new-feature.md`, `auth.md`, `email.md`).
- **`elysiajs-v1` skill**: Elysia's own API.
- **`elysiajs` skill**: describes Elysia 2. Do not use its signatures here.

## Commands

- `bun dev` · `bun test` · `bun run typecheck` · `bun run lint`
- `bun run build` (CI also checks the gzip budget with `scripts/build-size.ts`)
- `bun db:generate --name <name>` · `bun db:migrate` · `bun db:seed [names]`

## Conventions (summary; details in the `elysia-boilerplate` skill)

- **Module layout.** A module is `src/modules/<name>/` with:
  - `index.ts`: the Elysia controller (HTTP only, **no schemas**);
  - `model.ts`: schemas in four sections — table-derived, composed responses, query filters, no-table shapes (**never `schema.ts`**);
  - `service.ts`: business rules and orchestration (abstract class, static methods; no `db`, no Elysia);
  - `repository.ts`: every Drizzle query (returns rows or `undefined`; no business rules).
- **Cross-module calls** go through the other module's service, never its repository.

  Register every module in `src/app.ts`.
- **Architecture is tested.** `test/conventions.test.ts` enforces the layout, "no schemas in controllers", `process.env` only in `src/config/env.ts`, dialect imports only in `src/db/dialects`, no `.returning()`, and an identical column surface across dialects.
- **Services.** Services never receive the Elysia context or import `db`. They throw `AppError` subclasses from `#core/errors` and never build error responses.
- **Handlers.** Handlers return `ok()` / `paginated()` / `status(201, ok())` and declare `response: { 200: ..., ...errorResponses(...) }`. `errorResponses(...)` uses one model per status and always adds 429/500.
- **Schemas.** Build them from tables via `#db/typebox`.
  - Refinements are functions: `(column) => t.String({ ...column, ..., error: '...' })`.
  - `create` whitelists the fields clients may send.
  - Query filters owned by one endpoint live in that module's `model.ts`; shared params come from `idParams()`.
- **Dates and enums.**
  - `column.date()` is a date-only **string**; refine with `t.String({ format: 'date' })`.
  - `column.timestamp()` is a `Date` in app code and an ISO string on the wire.
  - `column.enum()` is a varchar + TS union; native enums are never used.
- **Guards.** Protect routes with the `auth: true`, `role: 'admin'` or `permission: {...}` macros. Ownership rules live in services (`can()`).
- **Auth plugins.** Better Auth plugins live in `src/lib/auth-features.ts`: one entry per capability (`plugin` and/or `paths`). Never append to the array in `src/lib/auth.ts`, and never pre-register a plugin the project does not support — a runtime `enabled` flag still bundles the code and its tables.
- **Feature switches.** Add the env var in `src/config/env.ts`, add the registry entry, and filter the route/path. Keep the server-side capability so seeders and tests still work.
- **Storage.** Only through `storage.disk()` from `#lib/storage`. Never `Bun.write` or an S3 SDK call in a module; keys are driver-independent (`files/<id>`).
- **Email.** Only through `MailService.queue` from `#modules/mail/service`; never call Resend from a feature. Templates live in `src/emails/` as pure `(data) => { subject, text, html }` functions with text required. Without `RESEND_API_KEY` the full text and html are logged.
- **Portable database code.**
  - Import table and column builders only from `#db/dialect`.
  - Use app-generated ids (`newId`).
  - Never use `.returning()`.
- **Build.** No import-time side effects and no `export *` barrels inside modules. Run `bun run build` when imports or dependencies change; CI enforces the gzip budget (`scripts/build-size.ts`).
- **Style.**
  - Use `#` import aliases.
  - Always chain Elysia calls.
  - Write all code, comments and docs in English.
- **Tests.** Every route gets a test in `test/` using Eden (`api`, `actingAs`). `bun test` drops and recreates the disposable test database first.

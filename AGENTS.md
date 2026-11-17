# Agent guide

Elysia **v1.4** REST API (Bun), created from the **elysia-boilerplate** template.

- **`elysia-boilerplate` skill** (`.agents/skills/elysia-boilerplate`): load it before adding or changing features, endpoints, tables, permissions or tests. It has the step-by-step recipe and the rules below in full.
- **`elysiajs-v1` skill**: Elysia's own API.
- **`elysiajs` skill**: describes Elysia 2. Do not use its signatures here.

## Commands

- `bun dev` · `bun test` · `bun run typecheck` · `bun run lint`
- `bun db:generate --name <name>` · `bun db:migrate` · `bun db:seed [names]`

## Conventions (summary; details in the `elysia-boilerplate` skill)

- **Module layout.** A module is `src/modules/<name>/` with:
  - `index.ts`: the Elysia controller (HTTP only);
  - `model.ts`: the schemas;
  - `service.ts`: business rules and orchestration (abstract class, static methods; no `db`, no Elysia);
  - `repository.ts`: every Drizzle query (returns rows or `undefined`; no business rules).
- **Cross-module calls** go through the other module's service, never its repository.

  Register every module in `src/app.ts`.
- **Services.** Services never receive the Elysia context or import `db`. They throw `AppError` subclasses from `#core/errors` and never build error responses.
- **Handlers.** Handlers return `ok()` / `paginated()` / `status(201, ok())` and declare `response: { 200: ..., ...errorResponses(...) }`.
- **Schemas.** Build them from tables via `#db/typebox`.
  - Refinements are functions: `(column) => t.String({ ...column, ..., error: '...' })`.
  - `create` whitelists the fields clients may send.
- **Guards.** Protect routes with the `auth: true`, `role: 'admin'` or `permission: {...}` macros. Ownership rules live in services (`can()`).
- **Portable database code.**
  - Import table and column builders only from `#db/dialect`.
  - Use app-generated ids (`newId`).
  - Never use `.returning()`.
- **Style.**
  - Use `#` import aliases.
  - Always chain Elysia calls.
  - Write all code, comments and docs in English.
- **Tests.** Every route gets a test in `test/` using Eden (`api`, `actingAs`).

---
name: elysia-boilerplate
description: Conventions of the elysia-boilerplate template (Elysia 1.4 + Better Auth + Drizzle). Use when adding or changing features, endpoints, tables, permissions, auth plugins, email/notifications, seeders or tests in a project created from this template, so the result follows its layers, response envelope, error classes, mail queue and portable database rules.
---

# elysia-boilerplate conventions

> Written for **Elysia 1.4**. If `package.json` has `elysia` 2.x, the code skeletons in `references/` are outdated: follow `docs/upgrading.md` (step "Update the elysia-boilerplate skill").

This project was created from the **elysia-boilerplate** template. For Elysia's own API use the `elysiajs-v1` skill. Do not use the `elysiajs` skill's signatures here: that skill is for Elysia 2.

## Layers (never mix them)

```
src/modules/<feature>/
  index.ts       controller   HTTP only: routes, guards, status codes, ok()/paginated() - no schemas
  model.ts       model        schemas in four sections: table-derived, composed responses, query filters, no-table shapes
  service.ts     service      business rules & orchestration; throws AppError; no db, no Elysia
  repository.ts  repository   every Drizzle query; returns rows or undefined; no business rules
```

- **Calls go downwards:** controller → service → repository.
- **Other modules:** call their **service**, never their repository.
- **"Not found":** the repository returns `undefined`; the service throws `NotFoundError`.
- **Services and repositories** are `abstract class`es with `static` methods.
- **Every module has `model.ts`.** `test/conventions.test.ts` fails when a controller declares a schema, a module lacks a model, or a dialect drifts.

## Rules that are easy to get wrong

| Rule | Why |
|---|---|
| Handlers return `ok(x)`, `paginated(items, meta)` or `status(201, ok(x))`, and declare `response: { 200: ..., ...errorResponses(...) }` | one envelope for clients; typed `data`/`error` in Eden and OpenAPI |
| `errorResponses(...)` maps **one model per status** and always adds `429`/`500` | a 422 has `details`, a 401 never does; docs stop lying |
| Throw `NotFoundError`, `ForbiddenError`, `FeatureDisabledError`, `ConflictError`, `UnprocessableEntityError.field(field, msg)` from `#core/errors`; never build error responses | the error-handler plugin produces the envelope |
| An unknown foreign id in the body is `UnprocessableEntityError.field('xId', '...')` (422), not 404 | it is invalid input on that field |
| Order checks: 404 (exists) → 403 (allowed) → 422 (referenced ids) | consistent, does not leak existence |
| Schemas come from tables via `#db/typebox`; refinements are **functions** `(column) => t.String({ ...column, ..., error: '...' })` | a schema object replaces the column and loses nullability/max length |
| Assign `createInsertSchema(...)` to a variable before using it in `t.Object`/`t.Omit` | avoids "type instantiation is excessively deep" |
| `create` **whitelists** fields (`t.Object({ a, b })`); wrap nullable refined columns in `t.Optional` | new columns are never writable by accident |
| Query/params numbers use Elysia's `t.Integer`/`t.Number`, not plain TypeBox | only Elysia's types coerce `"2"` → `2` |
| A filter used by one endpoint belongs in that module's `listQuery`; shared params use `idParams('x')` from `#core/schemas` | no shared grab-bag of unrelated filters |
| Range filters use ISO date-times on `column.timestamp`; date-only columns use `column.date()` (string) + `t.String({ format: 'date' })` | timezones must not shift dates |
| Tables use only `table`, `column.*`, `index` from `../dialect` and `timestamps()` from `../columns` | keeps PostgreSQL/MySQL/SQLite switchable |
| `column.enum()` is a varchar + TS union; never a native enum | SQLite has no enums |
| IDs from `newId()`; never `.returning()`; insert then `findById` | MySQL has no `RETURNING` |
| Case-insensitive search: `lower(col) like ... escape '!'`, never `ilike` | portable |
| Duplicates: wrap writes in `guardUnique()` in the repository; map `UniqueConstraintError` to `ConflictError` in the service | driver-independent 409 |
| Guards: `auth: true`, `role: 'admin'`, `permission: { resource: ['action'] }`; data-dependent rules (ownership) in the service with `can()` from `#core/access` | macros give typed `user`; ownership needs the row |
| Modules `.use(errorHandler).use(authGuard)` themselves | required for the error models and the macros' types |
| A Better Auth plugin is **one entry** in `#lib/auth-features` (`plugin` and/or `paths`); never append to an array, never pre-register unsupported plugins | a runtime `enabled` flag still bundles the plugin and its tables, and widens `auth.api` |
| Email only through `MailService.queue` (`#modules/mail/service`); templates are pure `(data) => { subject, text, html }` in `src/emails/` | keeps delivery out of the request and the console fallback working |
| Storage only through `storage.disk()` from `#lib/storage`; keys are driver-independent (`files/<id>`) | local, S3, Docker and Vercel stay interchangeable |
| A feature switch is an env var **plus** a route/path filter **plus** a docs filter (see `AUTH_SIGN_UP_ENABLED`) | a hidden endpoint must not appear in `/docs` |
| Always chain Elysia calls; keep handlers inline | the chain builds `type App` used by Eden |
| Imports use `#` aliases (`#db/client`, `#core/http`, `#shared`, `#lib/storage`) | works when other projects import the types |
| No import-time side effects and no `export *` barrels inside modules; `bun run build` must stay inside the CI gzip budget (`scripts/build-size.ts`) | bundle size is a checked property, not a guess |
| Code, comments and docs in English | public repository convention |

## Specialized references

This skill is the single entry point for the template. Details live in `references/`; read the matching file instead of growing this one:

| Topic | Reference |
|---|---|
| Better Auth plugins, capability switches, roles and permissions | [references/auth.md](references/auth.md) |
| Email queue, templates, drain triggers and email tests | [references/email.md](references/email.md) |
| Full new-module recipe | [references/new-feature.md](references/new-feature.md) |

Never create a new top-level skill folder for a template topic; add `references/<topic>.md` and a row here.

## Tasks

| Task | Read |
|---|---|
| New feature (table + CRUD endpoints), or one new endpoint, or a table only | [references/new-feature.md](references/new-feature.md) |
| Roles, permissions, Better Auth plugins, per-feature auth switches | [references/auth.md](references/auth.md) |
| Email notifications, templates, delivery problems | [references/email.md](references/email.md) |
| Driver switching, migrations, column builders, factories, seeders | `docs/database.md` |
| Validation messages, error classes, envelope, per-status error models | `docs/validation-and-errors.md` |
| Storage (local filesystem, S3/R2/MinIO, signed URLs) | `docs/storage.md` |
| Tests with Eden Treaty, test database lifecycle, contract/spec tests | `docs/testing.md` |
| Build, Docker, single binary, Vercel | `docs/deployment.md` |
| Where any other file goes | `docs/structure.md` |

## Finish every change with

```bash
bun run typecheck && bun run lint && bun test
```

A new route is not done until it has a test in `test/`. If you touched imports or added a dependency, run `bun run build`; CI checks the gzip budget (`scripts/build-size.ts`).

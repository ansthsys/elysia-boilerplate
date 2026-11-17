---
name: elysia-boilerplate
description: Conventions of the elysia-boilerplate template (Elysia 1.4 + Better Auth + Drizzle). Use when adding or changing features, endpoints, tables, permissions, seeders or tests in a project created from this template, so the result follows its layers, response envelope, error classes and portable database rules.
---

# elysia-boilerplate conventions

> Written for **Elysia 1.4**. If `package.json` has `elysia` 2.x, the code skeletons in `references/` are outdated: follow `docs/upgrading.md` (step "Update the elysia-boilerplate skill").

This project was created from the **elysia-boilerplate** template. For Elysia's own API use the `elysiajs-v1` skill. Do not use the `elysiajs` skill's signatures here: that skill is for Elysia 2.

## Layers (never mix them)

```
src/modules/<feature>/
  index.ts       controller   HTTP only: routes, schemas, guards, status codes, ok()/paginated()
  model.ts       model        request/response schemas + their types (XModel['create'])
  service.ts     service      business rules & orchestration; throws AppError; no db, no Elysia
  repository.ts  repository   every Drizzle query; returns rows or undefined; no business rules
```

- **Calls go downwards:** controller → service → repository.
- **Other modules:** call their **service**, never their repository.
- **"Not found":** the repository returns `undefined`; the service throws `NotFoundError`.
- **Services and repositories** are `abstract class`es with `static` methods.

## Rules that are easy to get wrong

| Rule | Why |
|---|---|
| Handlers return `ok(x)`, `paginated(items, meta)` or `status(201, ok(x))`, and declare `response: { 200: ..., ...errorResponses(...) }` | one envelope for clients; typed `data`/`error` in Eden and OpenAPI |
| Throw `NotFoundError`, `ForbiddenError`, `ConflictError`, `UnprocessableEntityError.field(field, msg)` from `#core/errors`; never build error responses | the error-handler plugin produces the envelope |
| An unknown foreign id in the body is `UnprocessableEntityError.field('xId', '...')` (422), not 404 | it is invalid input on that field |
| Order checks: 404 (exists) → 403 (allowed) → 422 (referenced ids) | consistent, does not leak existence |
| Schemas come from tables via `#db/typebox`; refinements are **functions** `(column) => t.String({ ...column, ..., error: '...' })` | a schema object replaces the column and loses nullability/max length |
| Assign `createInsertSchema(...)` to a variable before using it in `t.Object`/`t.Omit` | avoids "type instantiation is excessively deep" |
| `create` **whitelists** fields (`t.Object({ a, b })`); wrap nullable refined columns in `t.Optional` | new columns are never writable by accident |
| Query/params numbers use Elysia's `t.Integer`/`t.Number`, not plain TypeBox | only Elysia's types coerce `"2"` → `2` |
| Tables use only `table`, `column.*`, `index` from `../dialect` and `timestamps()` from `../columns` | keeps PostgreSQL/MySQL/SQLite switchable |
| IDs from `newId()`; never `.returning()`; insert then `findById` | MySQL has no `RETURNING` |
| Case-insensitive search: `lower(col) like ... escape '!'`, never `ilike` | portable |
| Duplicates: wrap writes in `guardUnique()` in the repository; map `UniqueConstraintError` to `ConflictError` in the service | driver-independent 409 |
| Guards: `auth: true`, `role: 'admin'`, `permission: { resource: ['action'] }`; data-dependent rules (ownership) in the service with `can()` from `#core/access` | macros give typed `user`; ownership needs the row |
| Modules `.use(errorHandler).use(authGuard)` themselves | required for the `ErrorResponse` model and the macros' types |
| Always chain Elysia calls; keep handlers inline | the chain builds `type App` used by Eden |
| Imports use `#` aliases (`#db/client`, `#core/http`, `#shared`) | works when other projects import the types |
| Code, comments and docs in English | public repository convention |

## Tasks

| Task | Read |
|---|---|
| New feature (table + CRUD endpoints), or one new endpoint, or a table only | [references/new-feature.md](references/new-feature.md) |
| Roles, permissions, Better Auth plugins | `docs/auth.md` |
| Driver switching, migrations, factories, seeders | `docs/database.md` |
| Validation messages, error classes, envelope | `docs/validation-and-errors.md` |
| Tests with Eden Treaty | `docs/testing.md` |
| Where any other file goes | `docs/structure.md` |

## Finish every change with

```bash
bun run typecheck && bun run lint && bun test
```

A new route is not done until it has a test in `test/`.

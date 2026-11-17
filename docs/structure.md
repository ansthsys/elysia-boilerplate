# Project structure

## Where does a new file go?

| You are adding                               | Put it in                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A feature / resource with endpoints          | `src/modules/<feature>/` with `index.ts`, `model.ts`, `service.ts`, then `.use()` it in `src/app.ts`                        |
| A table                                      | `src/db/schema/<table>.ts`, export it from `schema/index.ts`, add relations in `schema/relations.ts`, run `bun db:generate` |
| Fake data for a table                        | `src/db/factories/<table>.factory.ts` (export it from `factories/index.ts`)                                                 |
| Initial data for a table                     | `src/db/seeders/<table>.seeder.ts`, registered in `seeders/index.ts` (order = dependencies)                                 |
| An environment variable                      | `src/config/env.ts` and `.env.example`                                                                                      |
| A new kind of error                          | a class in `src/core/errors.ts` (and a code in `src/shared/errors.ts` if clients must tell it apart)                        |
| A cross-cutting hook (headers, tracing, ...) | `src/plugins/<name>.ts`, `.use()` it in `src/app.ts`                                                                        |
| A third-party client (S3, Redis, payments)   | `src/lib/<name>.ts`                                                                                                         |
| A type or rule frontends also need           | `src/shared/` (no imports from `db`, `lib` or `modules`)                                                                    |
| A permission (resource + actions)            | `src/shared/permissions.ts`                                                                                                 |
| Tests                                        | `test/<feature>.test.ts`                                                                                                    |

## Layers

```
index.ts (controller)  →  service.ts (business logic)  →  repository.ts (data access)  →  Drizzle
```

| Layer                          | Responsible for                                                                                                                                          | Must not                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Controller** `index.ts`      | HTTP: routes, request/response schemas, guards (`auth`, `role`, `permission`), status codes, wrapping results in `ok()` / `paginated()`                  | contain business rules or queries                                            |
| **Service** `service.ts`       | business rules and orchestration: "404 before 403", ownership, "the referenced category must exist", duplicates, pagination math, calling other services | import `db`/Drizzle or Elysia; build HTTP responses                          |
| **Repository** `repository.ts` | every ORM query of the module; returns rows or `undefined`; translates driver errors into data errors (`UniqueConstraintError`)                          | decide what is an error for the user (no `NotFoundError`), apply permissions |
| **Model** `model.ts`           | request/response schemas (`XModel`) and their types (`XModel['create']`), derived from the tables via `#db/typebox`                                      | contain logic                                                                |

Example of the split, from `posts`:

```ts
// controller: HTTP only
.patch('/:id', async ({ params, body, user }) => ok(await PostService.update(params.id, body, user)), {
  auth: true, body: PostModel.update, response: { 200: PostModel.postResponse, ...errorResponses(401, 403, 404, 422) },
})

// service: business rules, orchestration
static async update(id: string, input: PostModel['update'], actor: Actor) {
  const post = await PostService.findById(id)                      // 404 first
  PostService.assertCanModify(post.authorId, actor, 'update')      // then 403
  if (input.categoryId) await CategoryService.assertExists(input.categoryId) // 422 on the field
  await PostRepository.update(id, input)
  return PostService.findById(id)
}

// repository: data only
static async update(id: string, values: Partial<Omit<NewPost, 'id' | 'authorId'>>) {
  await db.update(posts).set(values).where(eq(posts.id, id))
}
```

Rules of thumb:

- **Cross-module access goes through the other module's service** (`CategoryService.assertExists`), never through its repository. Each module keeps its own rules.
- **Repositories and services are `abstract class`es with `static` methods.** They are stateless, so nothing needs to be instantiated or injected. Tests run against a real test database through the routes.
- **`404` is a service decision.** The repository returns `undefined`; the service throws `NotFoundError`.

## Recipe: a new module (`tags`)

1. Create `src/db/schema/tags.ts`:

   ```ts
   export const tags = table('tags', { id: column.id(), name: column.string('name', 50).notNull().unique(), ...timestamps() })
   ```

   Then export it from `schema/index.ts`.
2. Generate and apply the migration: `bun db:generate --name add_tags && bun db:migrate`
3. `src/modules/tags/model.ts`: copy `categories/model.ts`. Write refinements as **functions** and whitelist the `create` fields.
4. `src/modules/tags/repository.ts`: copy `CategoryRepository` (queries only), and `service.ts`: copy `CategoryService` (rules only).
5. `src/modules/tags/index.ts`:

   ```ts
   new Elysia({ prefix: '/api/tags', detail: { tags: ['Tags'] } }).use(errorHandler).use(authGuard)…
   ```
6. Wire it up:
   - `.use(tagsModule)` in `src/app.ts`
   - the tag in `src/plugins/openapi.ts`
7. Optionally add a factory and a seeder, then write `test/tags.test.ts` with `api.api.tags…`.

## Import aliases

Imports use the `#` aliases declared in `package.json` → `imports`, for example `#db/client`, `#core/errors`, `#modules/posts/service`, `#shared`.

Unlike `tsconfig` `paths`, these aliases keep working when another project imports this one's types (see [client.md](client.md)).

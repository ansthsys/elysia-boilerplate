# Validation, responses & errors

## Success responses

Handlers return through the helpers in `src/core/http.ts` and declare the shape in `response`.

Declaring `response` does two things:

- Eden and OpenAPI know the exact type.
- Fields that are not in the schema are stripped, so columns never leak by accident.

```ts
.get('/:id', async ({ params }) => ok(await PostService.findById(params.id)), {
  params: PostModel.params,
  response: { 200: PostModel.postResponse, ...errorResponses(404, 422) },
})

.post('', async ({ body, user, status }) => status(201, ok(await PostService.create(body, user))), { … })
```

`errorResponses(...)` documents the error statuses a route can return, using the `ErrorResponse` model. This is what makes `error.status` and `error.value` typed in Eden.

## Custom error classes

Throw these from services, macros or hooks - never from repositories, which only report data facts (`undefined`, `UniqueConstraintError`). They are defined in `src/core/errors.ts`, and the `error-handler` plugin turns each one into the standard envelope.

| Class                                                                     | Status | `error.code`          |
| ------------------------------------------------------------------------- | ------ | --------------------- |
| `BadRequestError`                                                         | 400    | `BAD_REQUEST`         |
| `UnauthorizedError`                                                       | 401    | `UNAUTHORIZED`        |
| `ForbiddenError`                                                          | 403    | `FORBIDDEN`           |
| `NotFoundError('Post')`                                                   | 404    | `NOT_FOUND`           |
| `ConflictError(message, details?)`                                        | 409    | `CONFLICT`            |
| `UnprocessableEntityError.field('categoryId', 'Category does not exist')` | 422    | `VALIDATION_ERROR`    |
| `TooManyRequestsError`                                                    | 429    | `TOO_MANY_REQUESTS`   |
| `ServiceUnavailableError`                                                 | 503    | `SERVICE_UNAVAILABLE` |

These are mapped to the same envelope too:

- Elysia's own errors: validation, unknown route, malformed JSON, `throw status(...)`.
- Unexpected errors: returned as 500, and the message is hidden in production.

Every error response carries the `requestId` that appears in the logs.

## Schemas from tables (drizzle-typebox)

```ts
import { createInsertSchema, createUpdateSchema } from '#db/typebox' // bound to Elysia's `t`

const refine = {
	// A FUNCTION keeps the column's nullability and its database max length.
	title: (column: TSchema) =>
		t.String({ ...column, minLength: 3, error: 'Title must be between 3 and 200 characters' }),
	categoryId: (column: TSchema) => t.String({ ...column, format: 'uuid', error: 'categoryId must be a valid id' }),
}

const insertPost = createInsertSchema(posts, refine) // assign to a variable first
const { title, content, categoryId } = insertPost.properties

export const PostModel = {
	create: t.Object({ title, content, categoryId }), // whitelist what clients may send
	update: t.Omit(createUpdateSchema(posts, refine), ['id', 'authorId', 'createdAt', 'updatedAt']),
}
```

Pitfalls this setup avoids (see the comments in the code):

- **Refinements must be functions.** A refinement given as a schema object replaces the column completely, including its nullability.
- **Nullable refined columns.** drizzle-typebox types a refined nullable column as _required_, although at runtime it is optional. Wrap it in `t.Optional(...)` in `create` (see `categories/model.ts`).
- **Assign before wrapping.** Store the result of `createInsertSchema` in a variable before wrapping it in `t.Omit`/`t.Object`. This avoids "type instantiation is excessively deep".

## Validation messages for the frontend

`details[]` is built like this:

- **`message`:** the schema's `error` option when present, otherwise TypeBox's default message.
- **`field`:** dot notation, e.g. `items.0.name`.
- **All at once:** every invalid field is returned in a single response.

```ts
const fieldErrors = Object.fromEntries((error.value.error.details ?? []).map((d) => [d.field, d.message]))
```

A business rule about a single field (for example, `categoryId` does not exist) is thrown as `UnprocessableEntityError.field(...)`. It therefore looks exactly like a validation error.

## Elysia 1.x behaviour worth knowing

- **Validation runs before guard macros.** `resolve` runs after validation, so an anonymous request with an invalid body gets 422, not 401.
- **Numeric query/params need Elysia's types.** They are coerced from strings only with `t.Integer`/`t.Number` from Elysia, not plain TypeBox.
- **Pagination is clamped, not rejected.** A failed `minimum`/`maximum` on a coerced number is reported without the field name, so pagination clamps instead: `page=0` becomes 1 and `limit=500` becomes 100. See `src/core/pagination.ts`.
- **Production keeps validation details.** They are still returned with `NODE_ENV=production`, because the envelope is built from `error.all`.

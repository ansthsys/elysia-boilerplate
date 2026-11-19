import { type TSchema, t } from 'elysia'
import { PaginationQuery } from '#core/pagination'
import { idParams } from '#core/schemas'
import { posts } from '#db/schema/index'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from '#db/typebox'
import { paginatedSchema, successSchema } from '#shared'

/**
 * Example of refining drizzle-typebox schemas with custom rules and messages.
 * `authorId` is never accepted from the client: it comes from the session.
 */
const refine = {
	title: (column: TSchema) =>
		t.String({ ...column, minLength: 3, error: 'Title must be between 3 and 200 characters' }),
	content: (column: TSchema) =>
		t.String({
			...column,
			minLength: 10,
			maxLength: 20_000,
			error: 'Content must be between 10 and 20,000 characters',
		}),
	categoryId: (column: TSchema) => t.String({ ...column, format: 'uuid', error: 'categoryId must be a valid id' }),
	/**
	 * Date-only column: drizzle-typebox emits `string | null`, so the null is
	 * dropped here (the column is nullable at the object level, and `create`
	 * wraps it in `t.Optional`) and the date format is enforced.
	 */
	publishedOn: () => t.String({ maxLength: 10, format: 'date', error: 'publishedOn must be a date (YYYY-MM-DD)' }),
}

const insertPost = createInsertSchema(posts, refine)
const updatePost = createUpdateSchema(posts, refine)
const selectPost = createSelectSchema(posts)

const { title, content, categoryId, publishedOn } = insertPost.properties

/** Shape returned by the API: the row plus a few fields of its relations. */
const PostSchema = t.Object({
	...selectPost.properties,
	author: t.Object({ id: t.String(), name: t.String() }),
	category: t.Object({ id: t.String(), name: t.String(), slug: t.String() }),
})

export const PostModel = {
	/** Whitelist of client-writable fields (authorId comes from the session). */
	create: t.Object({ title, content, categoryId, publishedOn: t.Optional(publishedOn) }),
	update: t.Omit(updatePost, ['id', 'authorId', 'createdAt', 'updatedAt']),
	params: idParams('post'),
	/**
	 * Pagination params + filters. Query strings are coerced to numbers by
	 * Elysia, and every filter is optional: filters that only exist for this
	 * endpoint live here, in the module's model, not in a shared schema.
	 */
	listQuery: t.Object({
		...PaginationQuery.properties,
		categoryId: t.Optional(t.String({ format: 'uuid', error: 'categoryId must be a valid id' })),
		authorId: t.Optional(t.String({ format: 'uuid', error: 'authorId must be a valid id' })),
		search: t.Optional(t.String({ minLength: 1, maxLength: 100, description: 'Case-insensitive match on title' })),
		createdAfter: t.Optional(
			t.String({ format: 'date-time', error: 'createdAfter must be an ISO date-time (e.g. 2026-01-31T00:00:00Z)' }),
		),
		createdBefore: t.Optional(
			t.String({ format: 'date-time', error: 'createdBefore must be an ISO date-time (e.g. 2026-01-31T00:00:00Z)' }),
		),
	}),
	post: PostSchema,
	postResponse: successSchema(PostSchema),
	listResponse: paginatedSchema(PostSchema),
	deleteResponse: successSchema(t.Null()),
} as const

export type PostModel = {
	[K in keyof typeof PostModel]: (typeof PostModel)[K]['static']
}

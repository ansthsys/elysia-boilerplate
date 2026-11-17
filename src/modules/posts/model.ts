import { type TSchema, t } from 'elysia'
import { PaginationQuery } from '#core/pagination'
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
}

const insertPost = createInsertSchema(posts, refine)
const updatePost = createUpdateSchema(posts, refine)
const selectPost = createSelectSchema(posts)

const { title, content, categoryId } = insertPost.properties

/** Shape returned by the API: the row plus a few fields of its relations. */
const PostSchema = t.Object({
	...selectPost.properties,
	author: t.Object({ id: t.String(), name: t.String() }),
	category: t.Object({ id: t.String(), name: t.String(), slug: t.String() }),
})

export const PostModel = {
	/** Whitelist of client-writable fields (authorId comes from the session). */
	create: t.Object({ title, content, categoryId }),
	update: t.Omit(updatePost, ['id', 'authorId', 'createdAt', 'updatedAt']),
	params: t.Object({ id: t.String({ format: 'uuid', error: 'Invalid post id' }) }),
	/** Pagination params + filters. Query strings are coerced to numbers by Elysia. */
	listQuery: t.Object({
		...PaginationQuery.properties,
		categoryId: t.Optional(t.String({ format: 'uuid', error: 'categoryId must be a valid id' })),
		authorId: t.Optional(t.String({ format: 'uuid', error: 'authorId must be a valid id' })),
		search: t.Optional(t.String({ minLength: 1, maxLength: 100, description: 'Case-insensitive match on title' })),
	}),
	post: PostSchema,
	postResponse: successSchema(PostSchema),
	listResponse: paginatedSchema(PostSchema),
	deleteResponse: successSchema(t.Null()),
} as const

export type PostModel = {
	[K in keyof typeof PostModel]: (typeof PostModel)[K]['static']
}

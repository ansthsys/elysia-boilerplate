import { type TSchema, t } from 'elysia'
import { categories } from '#db/schema/index'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from '#db/typebox'
import { successSchema } from '#shared'

/**
 * Request/response schemas, derived from the Drizzle table so column types
 * and max lengths stay in sync with the database.
 *
 * Refinements add the rules the table cannot express, plus a human readable
 * `error` message that ends up in `error.details[].message`. They are
 * functions so the column keeps its nullability and max length (`...column`).
 * (Always assign drizzle-typebox results to a variable before wrapping them
 * in t.Omit/t.Object - inlining them can hit "type instantiation is too deep".)
 */
const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'

const refine = {
	name: (column: TSchema) => t.String({ ...column, minLength: 2, error: 'Name must be between 2 and 100 characters' }),
	slug: (column: TSchema) =>
		t.String({
			...column,
			minLength: 2,
			pattern: SLUG_PATTERN,
			error: 'Slug must be 2-120 lowercase letters, numbers or dashes (e.g. "web-dev")',
		}),
	description: (column: TSchema) =>
		t.String({ ...column, maxLength: 500, error: 'Description must be at most 500 characters' }),
}

const insertCategory = createInsertSchema(categories, refine)
const updateCategory = createUpdateSchema(categories, refine)
const selectCategory = createSelectSchema(categories)

const { name, slug, description } = insertCategory.properties

export const CategoryModel = {
	/**
	 * Whitelist the client-writable fields instead of omitting server ones, so
	 * a new column is never accepted from clients by accident.
	 * `t.Optional` on nullable columns: drizzle-typebox types a refined
	 * nullable column as required (runtime is optional) - this makes both agree.
	 */
	create: t.Object({ name, slug, description: t.Optional(description) }),
	update: t.Omit(updateCategory, ['id', 'createdAt', 'updatedAt']),
	params: t.Object({ id: t.String({ format: 'uuid', error: 'Invalid category id' }) }),
	category: selectCategory,
	categoryResponse: successSchema(selectCategory),
	listResponse: successSchema(t.Array(selectCategory)),
	deleteResponse: successSchema(t.Null()),
} as const

/** `CategoryModel['create']` is the TypeScript type of the create body, etc. */
export type CategoryModel = {
	[K in keyof typeof CategoryModel]: (typeof CategoryModel)[K]['static']
}

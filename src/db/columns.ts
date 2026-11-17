import { column } from './dialect'

/**
 * Reusable column groups. Defaults are produced by the app (not the database)
 * so they behave the same on every dialect.
 */
export const timestamps = () => ({
	createdAt: column
		.timestamp('created_at')
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: column
		.timestamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
})

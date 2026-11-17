import { timestamps } from '../columns'
import { column, table } from '../dialect'

export const categories = table('categories', {
	id: column.id(),
	name: column.string('name', 100).notNull().unique(),
	slug: column.string('slug', 120).notNull().unique(),
	description: column.text('description'),
	...timestamps(),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

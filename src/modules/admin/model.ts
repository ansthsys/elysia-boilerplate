import { t } from 'elysia'
import { successSchema } from '#shared'

/** Aggregates, not a table: section 4 of the model rules. */
const StatsSchema = t.Object({
	users: t.Integer(),
	posts: t.Integer(),
	categories: t.Integer(),
})

export const AdminModel = {
	stats: StatsSchema,
	statsResponse: successSchema(StatsSchema),
} as const

export type AdminModel = {
	[K in keyof typeof AdminModel]: (typeof AdminModel)[K]['static']
}

import { timestamps } from '../columns'
import { column, index, table } from '../dialect'
import { users } from './auth'

/**
 * Metadata only: the bytes live on a storage disk (see src/lib/storage).
 * `key` is unique because it is the driver-independent object name; `disk`
 * is recorded so a project can move storage providers without breaking rows
 * written by the previous one.
 */
export const files = table(
	'files',
	{
		id: column.id(),
		key: column.string('key', 512).notNull().unique(),
		disk: column.enum('disk', ['local', 's3']).notNull(),
		mime: column.string('mime', 150).notNull(),
		size: column.integer('size').notNull(),
		originalName: column.string('original_name', 255),
		visibility: column.enum('visibility', ['private', 'public']).notNull(),
		ownerId: column.foreignId('owner_id').references(() => users.id, { onDelete: 'cascade' }),
		...timestamps(),
	},
	(t) => [index('files_owner_id_idx').on(t.ownerId)],
)

export type FileRecord = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert

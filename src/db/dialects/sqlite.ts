import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../id'

/**
 * SQLite dialect (driver: bun:sqlite, no extra package).
 * DATABASE_URL examples: file:./data/app.db  |  :memory:
 */
export const dialect = { name: 'sqlite', kit: 'sqlite', betterAuth: 'sqlite' } as const

export const table = sqliteTable
export type { SQLiteTable as AnyTable } from 'drizzle-orm/sqlite-core'
export { index, uniqueIndex }

export const column = {
	id: (name = 'id') => text(name, { length: 36 }).primaryKey().$defaultFn(newId),
	foreignId: (name: string) => text(name, { length: 36 }),
	string: (name: string, length = 255) => text(name, { length }),
	text: (name: string) => text(name),
	boolean: (name: string) => integer(name, { mode: 'boolean' }),
	integer: (name: string) => integer(name),
	timestamp: (name: string) => integer(name, { mode: 'timestamp_ms' }),
}

const toPath = (url: string) => url.replace(/^file:/, '')
const isMemory = (url: string) => toPath(url) === ':memory:'

export function connect<TSchema extends Record<string, unknown>>(url: string, schema: TSchema) {
	const client = new Database(toPath(url), { create: true, strict: true })
	client.run('PRAGMA journal_mode = WAL;')
	client.run('PRAGMA foreign_keys = ON;') // SQLite ignores foreign keys unless enabled
	const db = drizzle(client, { schema })

	return {
		db,
		ping: async () => db.run(sql`select 1`),
		migrate: async (migrationsFolder: string) => migrate(db, { migrationsFolder }),
		close: async () => client.close(),
	}
}

/** Database provisioning, used by `bun db:migrate`: the database is a file. */
export const provisioning = {
	databaseName: (url: string) => toPath(url),

	exists: async (url: string) => isMemory(url) || Bun.file(toPath(url)).exists(),

	async create(url: string) {
		await mkdir(dirname(toPath(url)), { recursive: true })
		new Database(toPath(url), { create: true }).close()
	},
}

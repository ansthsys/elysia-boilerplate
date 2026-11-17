import { sql } from 'drizzle-orm'
import {
	datetime,
	index,
	int,
	boolean as myBoolean,
	mysqlTable,
	text as myText,
	uniqueIndex,
	varchar,
} from 'drizzle-orm/mysql-core'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'
import { newId } from '../id'

/**
 * MySQL / MariaDB dialect (driver: mysql2).
 * DATABASE_URL example: mysql://user:pass@localhost:3306/app
 *
 * MySQL cannot index TEXT columns: use `column.string()` for anything unique or indexed.
 */
export const dialect = { name: 'mysql', kit: 'mysql', betterAuth: 'mysql' } as const

export const table = mysqlTable
export type { MySqlTable as AnyTable } from 'drizzle-orm/mysql-core'
export { index, uniqueIndex }

export const column = {
	id: (name = 'id') => varchar(name, { length: 36 }).primaryKey().$defaultFn(newId),
	foreignId: (name: string) => varchar(name, { length: 36 }),
	string: (name: string, length = 255) => varchar(name, { length }),
	text: (name: string) => myText(name),
	boolean: (name: string) => myBoolean(name),
	integer: (name: string) => int(name),
	/** DATETIME(3) stored in UTC (the pool uses `timezone: 'Z'`). */
	timestamp: (name: string) => datetime(name, { mode: 'date', fsp: 3 }),
}

export function connect<TSchema extends Record<string, unknown>>(url: string, schema: TSchema) {
	const client = mysql.createPool({ uri: url, connectionLimit: 10, timezone: 'Z' })
	const db = drizzle(client, { schema, mode: 'default' })

	return {
		db,
		ping: () => db.execute(sql`select 1`),
		migrate: (migrationsFolder: string) => migrate(db, { migrationsFolder }),
		close: () => client.end(),
	}
}

/**
 * Database provisioning, used by `bun db:migrate` before connecting.
 * Connects to the server without selecting a database.
 */
export const provisioning = {
	databaseName: (url: string) => decodeURIComponent(new URL(url).pathname.slice(1)),

	async exists(url: string) {
		return withServer(url, async (connection) => {
			const [rows] = await connection.query(
				'select schema_name from information_schema.schemata where schema_name = ?',
				[provisioning.databaseName(url)],
			)
			return Array.isArray(rows) && rows.length > 0
		})
	},

	async create(url: string) {
		const name = assertIdentifier(provisioning.databaseName(url))
		await withServer(url, (connection) => connection.query(`create database \`${name}\``))
	},
}

async function withServer<T>(url: string, run: (connection: mysql.Connection) => Promise<T>): Promise<T> {
	const server = new URL(url)
	server.pathname = '/'
	const connection = await mysql.createConnection({ uri: server.toString() })
	try {
		return await run(connection)
	} finally {
		await connection.end()
	}
}

/** Database names are interpolated into DDL, so only plain identifiers are accepted. */
function assertIdentifier(name: string) {
	if (!/^[A-Za-z0-9_][A-Za-z0-9_$-]{0,63}$/.test(name)) throw new Error(`Invalid database name "${name}"`)
	return name
}

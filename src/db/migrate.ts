import { env } from '#config/env'
import { logger } from '#lib/logger'
import { dialect, provisioning } from './dialect'

/**
 * What to do when the database in DATABASE_URL does not exist yet:
 * - `ask`: prompt in an interactive terminal, refuse otherwise (default)
 * - `always`: create it without asking (`--create-db`, tests)
 * - `never`: fail (`--no-create-db`)
 */
export type CreateDatabase = 'ask' | 'always' | 'never'

export async function ensureDatabase(mode: CreateDatabase, url = env.DATABASE_URL) {
	if (await provisioning.exists(url)) return

	const name = provisioning.databaseName(url)
	const interactive = mode === 'ask' && process.stdin.isTTY
	const create =
		mode === 'always' || (interactive && confirm(`The database "${name}" does not exist. Would you like to create it?`))

	if (!create) {
		const hint = interactive ? '' : ' Run `bun db:migrate --create-db` to create it.'
		throw new Error(`Database "${name}" does not exist.${hint}`)
	}

	await provisioning.create(url)
	logger.info(`Created database "${name}" (${dialect.name})`)
}

/** Applies pending migrations from drizzle/<dialect>. */
export async function runMigrations({ createDatabase = 'ask' }: { createDatabase?: CreateDatabase } = {}) {
	await ensureDatabase(createDatabase)
	// Imported after the database exists: SQLite opens its file as soon as the client module loads.
	const { database } = await import('./client')
	await database.migrate(`${import.meta.dir}/../../drizzle/${dialect.name}`)
	return database
}

/**
 * Usage:
 *   bun db:migrate                  asks before creating a missing database
 *   bun db:migrate --create-db      creates it without asking (CI, Docker)
 *   bun db:migrate --no-create-db   never creates it
 */
if (import.meta.main) {
	const args = process.argv.slice(2)
	const mode: CreateDatabase = args.includes('--create-db')
		? 'always'
		: args.includes('--no-create-db')
			? 'never'
			: 'ask'

	try {
		const database = await runMigrations({ createDatabase: mode })
		logger.info(`Migrations applied (${dialect.name})`)
		await database.close()
	} catch (error) {
		logger.error(error instanceof Error ? error.message : error)
		process.exit(1) // also ends a connection pool left open by a failed migration
	}
}

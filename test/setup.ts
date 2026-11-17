import { afterAll } from 'bun:test'
import { runMigrations } from '#db/migrate'

/**
 * Runs once before the test files (see bunfig.toml).
 * The test database is disposable, so it is created when missing. Tests
 * create their own data with factories and never depend on seeders.
 */
await runMigrations({ createDatabase: 'always' })

afterAll(async () => {
	const { database } = await import('#db/client')
	await database.close()
})

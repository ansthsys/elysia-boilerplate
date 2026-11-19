import { afterAll } from 'bun:test'
import { env, isTest } from '#config/env'
import { provisioning } from '#db/dialect'
import { runMigrations } from '#db/migrate'

/**
 * Runs once before the test files (see bunfig.toml).
 *
 * The test database is dropped and recreated instead of truncated:
 * - dropping at the start is idempotent, and a crashed run can never leave a
 *   dirty database behind (which is exactly what happens if you only clean up
 *   in `afterAll`);
 * - per-test truncation is unsafe: the suite shares one process and one
 *   database, so cleanup would race with the factories of whichever test runs
 *   next.
 *
 * Tests create their own data with factories and never depend on seeders.
 */
const databaseName = provisioning.databaseName(env.DATABASE_URL)
const isDisposable =
	databaseName.endsWith('_test') || databaseName === ':memory:' || /(^|\/)test[^/]*\.(db|sqlite3?)$/.test(databaseName)

if (!isTest || !isDisposable) {
	throw new Error(
		`Refusing to run tests against "${databaseName}": NODE_ENV must be "test" and the database must be ` +
			'disposable (name ending in _test, an in-memory SQLite database, or a file matching test*.db).',
	)
}

await provisioning.drop(env.DATABASE_URL)
await runMigrations({ createDatabase: 'always' })

afterAll(async () => {
	const { database } = await import('#db/client')
	await database.close()
})

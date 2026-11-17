import { describe, expect, it } from 'bun:test'
import { env } from '#config/env'
import { dialect } from '#db/dialect'
import { ensureDatabase } from '#db/migrate'

/** DATABASE_URL pointing at a database that does not exist on the same server. */
function missingDatabaseUrl() {
	const name = `missing_${crypto.randomUUID().slice(0, 8)}`
	const driver: string = dialect.name // widened: the active dialect is a literal type
	if (driver === 'sqlite') return `file:${import.meta.dir}/../data/${name}/never-created.db`
	const url = new URL(env.DATABASE_URL)
	url.pathname = `/${name}`
	return url.toString()
}

// Creating a database is covered by test/setup.ts, which provisions the test database when missing.
describe('db:migrate database check', () => {
	it('accepts an existing database', async () => {
		await expect(ensureDatabase('never')).resolves.toBeUndefined()
	})

	it('refuses to create a missing database with --no-create-db', async () => {
		await expect(ensureDatabase('never', missingDatabaseUrl())).rejects.toThrow(/does not exist/)
	})

	it('never prompts without a terminal and suggests --create-db', async () => {
		await expect(ensureDatabase('ask', missingDatabaseUrl())).rejects.toThrow(/--create-db/)
	})
})

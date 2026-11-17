import { isProduction } from '#config/env'
import { logger } from '#lib/logger'
import { database } from './client'
import { seeders } from './seeders'

/**
 * Usage:
 *   bun db:seed                 → every seeder, in order
 *   bun db:seed users posts     → only the named seeders (still in registry order)
 */
const requested = process.argv.slice(2)
const unknown = requested.filter((name) => !seeders.some((seeder) => seeder.name === name))

if (isProduction) {
	logger.error('Refusing to seed in production')
	process.exit(1)
}
if (unknown.length) {
	logger.error(`Unknown seeder(s): ${unknown.join(', ')}. Available: ${seeders.map((s) => s.name).join(', ')}`)
	process.exit(1)
}

try {
	for (const seeder of seeders) {
		if (requested.length && !requested.includes(seeder.name)) continue
		const result = await seeder.run()
		logger.info(`seeded ${seeder.name}${result ? `: ${result}` : ''}`)
	}
} catch (error) {
	logger.error({ err: error }, 'Seeding failed')
	process.exitCode = 1
} finally {
	await database.close()
}

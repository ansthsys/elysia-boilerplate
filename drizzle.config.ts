import { defineConfig } from 'drizzle-kit'
import { dialect } from './src/db/dialect'

/**
 * Migrations are generated per dialect (drizzle/postgres, drizzle/mysql, ...)
 * so switching drivers never mixes incompatible SQL.
 */
export default defineConfig({
	dialect: dialect.kit,
	schema: './src/db/schema/index.ts',
	out: `./drizzle/${dialect.name}`,
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	casing: 'snake_case',
	strict: true,
	verbose: true,
})

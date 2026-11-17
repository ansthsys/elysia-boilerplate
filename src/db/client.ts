import { env } from '#config/env'
import { connect } from './dialect'
import * as schema from './schema'

/**
 * The single database connection of the app.
 * Services import `db` from here; only `dialect.ts` knows which driver is used.
 */
export const database = connect(env.DATABASE_URL, schema)
export const db = database.db
export type Database = typeof db

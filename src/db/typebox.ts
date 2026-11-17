import { createSchemaFactory } from 'drizzle-typebox'
import { t } from 'elysia'

/**
 * drizzle-typebox bound to Elysia's `t`, so generated schemas get Elysia's
 * behaviour (numbers coerced from strings, dates accepted as ISO strings).
 * Import these instead of the ones from 'drizzle-typebox'.
 *
 * Refinements: pass a FUNCTION `(schema) => t.String({ ...schema, minLength: 3 })`.
 * A function keeps the column's nullable/optional wrapping and its max length;
 * a plain schema object replaces the column definition entirely.
 */
export const { createInsertSchema, createSelectSchema, createUpdateSchema } = createSchemaFactory({
	typeboxInstance: t,
})

import { t } from 'elysia'
import { successSchema } from '#shared'

/**
 * Health has no table behind it, so the shapes are hand-written: section 4 of
 * the model rules ("schemas for endpoints without a table").
 */
const HealthSchema = t.Object({
	status: t.Literal('ok'),
	database: t.Object({ driver: t.String(), latencyMs: t.Number() }),
	uptimeSeconds: t.Number(),
})

export const HealthModel = {
	health: HealthSchema,
	healthResponse: successSchema(HealthSchema),
} as const

export type HealthModel = {
	[K in keyof typeof HealthModel]: (typeof HealthModel)[K]['static']
}

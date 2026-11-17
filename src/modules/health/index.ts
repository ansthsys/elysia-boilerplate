import { Elysia, t } from 'elysia'
import { errorResponses, ok } from '#core/http'
import { errorHandler } from '#plugins/error-handler'
import { successSchema } from '#shared'
import { HealthService } from './service'

const HealthSchema = t.Object({
	status: t.Literal('ok'),
	database: t.Object({ driver: t.String(), latencyMs: t.Number() }),
	uptimeSeconds: t.Number(),
})

/** Liveness + database check for load balancers and uptime monitors. */
export const healthModule = new Elysia({ prefix: '/health', detail: { tags: ['Health'] } })
	.use(errorHandler)
	.get('', async () => ok(await HealthService.check()), {
		response: { 200: successSchema(HealthSchema), ...errorResponses(503) },
		detail: { summary: 'Health check' },
	})

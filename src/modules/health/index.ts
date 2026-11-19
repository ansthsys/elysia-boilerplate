import { Elysia } from 'elysia'
import { errorResponses, ok } from '#core/http'
import { errorHandler } from '#plugins/error-handler'
import { HealthModel } from './model'
import { HealthService } from './service'

/** Liveness + database check for load balancers and uptime monitors. */
export const healthModule = new Elysia({ prefix: '/health', detail: { tags: ['Health'] } })
	.use(errorHandler)
	.get('', async () => ok(await HealthService.check()), {
		response: { 200: HealthModel.healthResponse, ...errorResponses(503) },
		detail: { summary: 'Health check' },
	})

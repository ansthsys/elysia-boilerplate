import { Elysia, t } from 'elysia'
import { errorResponses, ok } from '#core/http'
import { authGuard } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { successSchema } from '#shared'
import { AdminService } from './service'

/**
 * Admin-only endpoints - example of the `role` macro.
 * User management (list, ban, set role, impersonate) is already provided by
 * Better Auth's admin plugin under /api/auth/admin/*.
 */
export const adminModule = new Elysia({ prefix: '/api/admin', detail: { tags: ['Admin'] } })
	.use(errorHandler)
	.use(authGuard)
	.get('/stats', async () => ok(await AdminService.stats()), {
		role: 'admin',
		response: {
			200: successSchema(t.Object({ users: t.Integer(), posts: t.Integer(), categories: t.Integer() })),
			...errorResponses(401, 403),
		},
		detail: { summary: 'Dashboard counters', description: 'Requires the `admin` role.' },
	})

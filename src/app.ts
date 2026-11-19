import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { corsOrigins, env } from '#config/env'
import { ok } from '#core/http'
import { adminModule } from '#modules/admin/index'
import { categoriesModule } from '#modules/categories/index'
import { filesModule } from '#modules/files/index'
import { healthModule } from '#modules/health/index'
import { mailModule } from '#modules/mail/index'
import { postsModule } from '#modules/posts/index'
import { authRoutes } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { openapiPlugin } from '#plugins/openapi'
import { rateLimit } from '#plugins/rate-limit'
import { requestLogger } from '#plugins/request-logger'
import { securityHeaders } from '#plugins/security-headers'
import pkg from '../package.json'

/**
 * Composition root. Order matters: hooks only apply to routes registered
 * after them, so global plugins come first, feature modules last.
 *
 * Always chain (never `app.use(...)` on a separate line) - the chain is what
 * builds the `App` type used by Eden and the tests.
 */
export const app = new Elysia({ name: 'app' })
	.use(securityHeaders)
	.use(requestLogger)
	.use(errorHandler)
	.use(
		cors({
			origin: corsOrigins,
			credentials: true,
			allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
			exposeHeaders: ['X-Request-Id'],
		}),
	)
	.use(rateLimit)
	.use(openapiPlugin)
	.use(authRoutes)
	.use(mailModule)
	.get('/', () => ok({ name: env.APP_NAME, version: pkg.version, docs: '/docs' }), {
		detail: { hide: true },
	})
	.use(healthModule)
	.use(categoriesModule)
	.use(postsModule)
	.use(filesModule)
	.use(adminModule)

export type App = typeof app

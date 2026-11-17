import type { Server } from 'bun'
import { Elysia } from 'elysia'
import { rateLimit as rateLimitPlugin } from 'elysia-rate-limit'
import { env } from '#config/env'
import { TooManyRequestsError } from '#core/errors'

/**
 * Global per-IP rate limit (in-memory). For several instances behind a load
 * balancer, plug a shared store via the `context` option.
 *
 * Skipped for health checks and for /api/auth, which Better Auth limits itself.
 *
 * The client IP is the socket address, read from the server captured in `onStart`.
 * With TRUST_PROXY=true it is the first `X-Forwarded-For` entry instead -
 * only enable that behind a proxy that sets the header, otherwise clients
 * can spoof it.
 */
let server: Server<unknown> | null = null

export const rateLimit = new Elysia({ name: 'plugin.rate-limit' })
	.onStart((app) => {
		server = app.server
	})
	.use(
		rateLimitPlugin({
			max: env.RATE_LIMIT_MAX,
			duration: env.RATE_LIMIT_WINDOW_MS,
			scoping: 'global',
			errorResponse: new TooManyRequestsError(),
			injectServer: () => server,
			generator: (request, socket) => {
				if (env.TRUST_PROXY) {
					const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
					if (forwarded) return forwarded
				}
				return socket?.requestIP(request)?.address ?? 'unknown'
			},
			skip: (request) => {
				if (!env.RATE_LIMIT_ENABLED || request.method === 'OPTIONS') return true
				const { pathname } = new URL(request.url)
				return pathname === '/health' || pathname.startsWith('/api/auth/')
			},
		}),
	)

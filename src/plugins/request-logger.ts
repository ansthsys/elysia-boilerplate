import { Elysia } from 'elysia'
import { logger } from '#lib/logger'

/**
 * Per-request logging.
 *
 * - `derive` (as: 'global') adds `requestId` and a child `log` to every
 *   handler context. It runs before validation, so the id exists even for
 *   requests that fail validation.
 * - The id is echoed in the `x-request-id` header and in error responses,
 *   so a user-reported error can be found in the logs.
 * - `onAfterResponse` writes one line per request once it has been sent.
 */
const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/

export const requestLogger = new Elysia({ name: 'plugin.request-logger' })
	.derive({ as: 'global' }, ({ request, set }) => {
		// Reuse the caller's id (e.g. from a proxy) only when it is short and plain, so it is safe to log.
		const incoming = request.headers.get('x-request-id')
		const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID()
		set.headers['x-request-id'] = requestId
		return { requestId, log: logger.child({ requestId }), startedAt: performance.now() }
	})
	.onAfterResponse({ as: 'global' }, (ctx) => {
		// Unmatched routes (404) never run `derive`, hence the fallbacks.
		const startedAt = 'startedAt' in ctx ? ctx.startedAt : undefined
		const status = typeof ctx.set.status === 'number' ? ctx.set.status : 200
		const entry = {
			requestId: ctx.set.headers['x-request-id'],
			method: ctx.request.method,
			path: ctx.path,
			status,
			durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
		}
		if (status >= 500) logger.error(entry, 'request failed')
		else if (status >= 400) logger.warn(entry, 'request rejected')
		else logger.info(entry, 'request completed')
	})

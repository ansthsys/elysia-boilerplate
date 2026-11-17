import type { PaginationMeta } from '#shared'

/**
 * Success responses. Handlers always return through these helpers so every
 * response has the same envelope - and Eden/OpenAPI see the exact type.
 *
 *   return ok(post)                 → { success: true, data: post }
 *   return paginated(items, meta)   → { success: true, data: items, meta }
 */
export const ok = <T>(data: T) => ({ success: true as const, data })

export const paginated = <T>(data: T[], meta: PaginationMeta) => ({
	success: true as const,
	data,
	meta,
})

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503

/**
 * Documents the error responses a route can produce (OpenAPI + Eden types).
 * Every status points to the `ErrorResponse` model registered by the
 * error-handler plugin, so the module must `.use(errorHandler)`.
 *
 *   response: { 200: ..., ...errorResponses(401, 404, 422) }
 */
export const errorResponses = <const S extends readonly ErrorStatus[]>(...statuses: S) =>
	Object.fromEntries(statuses.map((status) => [status, 'ErrorResponse'])) as {
		[K in S[number]]: 'ErrorResponse'
	}

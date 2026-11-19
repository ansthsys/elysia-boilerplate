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

/**
 * Error status → the named model registered by the error-handler plugin.
 * One model per status, not one shared `ErrorResponse`: the generated docs
 * then show that a 422 has `details` and a 401 does not, and Eden narrows
 * `error.value` by status.
 */
const ERROR_MODELS = {
	400: 'BadRequestError',
	401: 'UnauthorizedError',
	403: 'ForbiddenError',
	404: 'NotFoundError',
	409: 'ConflictError',
	422: 'ValidationError',
	429: 'TooManyRequestsError',
	500: 'InternalServerError',
	503: 'ServiceUnavailableError',
} as const

export type ErrorStatus = keyof typeof ERROR_MODELS

/**
 * 429 and 500 are reachable from *every* route (global rate limit, any
 * unhandled throw), so they are always documented. Omitting them produced a
 * spec that lied about what clients can receive.
 */
const ALWAYS_DOCUMENTED = [429, 500] as const satisfies readonly ErrorStatus[]

/**
 * Documents the error responses a route can produce (OpenAPI + Eden types).
 * The module must `.use(errorHandler)` for these models to resolve.
 *
 *   response: { 200: ..., ...errorResponses(401, 404, 422) }
 */
export const errorResponses = <const S extends readonly ErrorStatus[]>(...statuses: S) =>
	Object.fromEntries(
		[...new Set<ErrorStatus>([...statuses, ...ALWAYS_DOCUMENTED])].map((status) => [status, ERROR_MODELS[status]]),
	) as {
		[K in S[number] | (typeof ALWAYS_DOCUMENTED)[number]]: (typeof ERROR_MODELS)[K]
	}

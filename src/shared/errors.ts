/**
 * Error codes returned in `error.code` of every failed response.
 *
 * The frontend should branch on `code` (stable) rather than on `message`
 * (human readable, may change). Add a new code here when a new kind of
 * failure needs distinct handling on the client.
 */
export const ErrorCode = {
	BAD_REQUEST: 'BAD_REQUEST',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	/** The deployment switched the feature off (see the `AUTH_*` switches). */
	FEATURE_DISABLED: 'FEATURE_DISABLED',
	NOT_FOUND: 'NOT_FOUND',
	CONFLICT: 'CONFLICT',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
	INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

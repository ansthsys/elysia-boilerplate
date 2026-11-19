import {
	Elysia,
	ElysiaCustomStatusResponse,
	InvalidCookieSignature,
	InvalidFileType,
	ParseError,
	// Aliased: `NotFoundError` is also the name of our own error in #core/errors.
	NotFoundError as RouteNotFoundError,
	ValidationError,
} from 'elysia'
import { isProduction } from '#config/env'
import { AppError } from '#core/errors'
import { logger } from '#lib/logger'
import {
	BadRequestErrorSchema,
	ConflictErrorSchema,
	ErrorCode,
	type ErrorDetail,
	ForbiddenErrorSchema,
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	ServiceUnavailableErrorSchema,
	TooManyRequestsErrorSchema,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
} from '#shared'

type Location = NonNullable<ErrorDetail['location']>
const LOCATIONS = new Set<string>(['body', 'query', 'params', 'headers', 'cookie'])

/** `/address/city` → `address.city`; custom `error` in the schema wins over TypeBox's message. */
function toErrorDetails(error: Pick<ValidationError, 'type' | 'all'>): ErrorDetail[] {
	const location = LOCATIONS.has(error.type) ? (error.type as Location) : undefined
	return error.all.map((issue) => {
		const custom = (issue.schema as { error?: unknown }).error
		return {
			field: issue.path.replace(/^\//, '').replaceAll('/', '.') || 'root',
			message: typeof custom === 'string' ? custom : issue.message,
			...(location && { location }),
		}
	})
}

const statusCodes: Record<number, ErrorCode> = {
	400: ErrorCode.BAD_REQUEST,
	401: ErrorCode.UNAUTHORIZED,
	403: ErrorCode.FORBIDDEN,
	404: ErrorCode.NOT_FOUND,
	409: ErrorCode.CONFLICT,
	422: ErrorCode.VALIDATION_ERROR,
	429: ErrorCode.TOO_MANY_REQUESTS,
	503: ErrorCode.SERVICE_UNAVAILABLE,
}

/**
 * Converts every error into the standard envelope:
 *   { success: false, error: { code, message, details?, requestId? } }
 *
 * Registered globally (`as: 'global'`) so it covers every module, and named
 * so modules can `.use()` it for the error models without registering the
 * hook twice. One model per status: see `src/shared/response.ts`.
 */
export const errorHandler = new Elysia({ name: 'plugin.error-handler' })
	.model({
		BadRequestError: BadRequestErrorSchema,
		UnauthorizedError: UnauthorizedErrorSchema,
		ForbiddenError: ForbiddenErrorSchema,
		NotFoundError: NotFoundErrorSchema,
		ConflictError: ConflictErrorSchema,
		ValidationError: ValidationErrorSchema,
		TooManyRequestsError: TooManyRequestsErrorSchema,
		InternalServerError: InternalServerErrorSchema,
		ServiceUnavailableError: ServiceUnavailableErrorSchema,
	})
	.onError({ as: 'global' }, ({ error, status, set, request, path }) => {
		const requestId = set.headers['x-request-id'] as string | undefined
		const fail = (httpStatus: number, errorCode: ErrorCode, message: string, details?: ErrorDetail[]) =>
			status(httpStatus, {
				success: false as const,
				error: { code: errorCode, message, ...(details?.length && { details }), ...(requestId && { requestId }) },
			})

		// Dispatch with `instanceof`, not the `code` string: Elysia 2 removes `error.code`.
		if (error instanceof AppError) return fail(error.status, error.code, error.message, error.details)

		// An invalid *response* is a bug on our side, never the client's fault: falls through to 500.
		if (error instanceof ValidationError && error.type !== 'response') {
			return fail(422, ErrorCode.VALIDATION_ERROR, 'Validation failed', toErrorDetails(error))
		}
		if (error instanceof RouteNotFoundError) return fail(404, ErrorCode.NOT_FOUND, 'Route not found')
		if (error instanceof ParseError) return fail(400, ErrorCode.BAD_REQUEST, 'Malformed request body')
		if (error instanceof InvalidCookieSignature) return fail(400, ErrorCode.BAD_REQUEST, 'Invalid cookie signature')
		if (error instanceof InvalidFileType) return fail(422, ErrorCode.VALIDATION_ERROR, error.message)

		// `throw status(404, 'message')` from Elysia itself.
		if (error instanceof ElysiaCustomStatusResponse) {
			const code = statusCodes[error.code]
			if (code) {
				const message = typeof error.response === 'string' ? error.response : 'Request failed'
				return fail(error.code, code, message)
			}
		}

		logger.error({ err: error, requestId, method: request.method, path }, 'Unhandled error')
		const message = !isProduction && error instanceof Error ? error.message : 'Internal server error'
		return fail(500, ErrorCode.INTERNAL_SERVER_ERROR, message)
	})

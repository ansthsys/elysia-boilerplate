import { ErrorCode, type ErrorDetail } from '#shared'

/**
 * Custom errors. Throw them anywhere (services, macros, hooks): the error
 * handler plugin turns them into the standard error envelope, so no code
 * ever builds an error response by hand.
 *
 *   throw new NotFoundError('Post')                       → 404 NOT_FOUND
 *   throw new ConflictError('Slug already taken', [{ field: 'slug', message: '...' }])
 *   throw UnprocessableEntityError.field('categoryId', 'Category does not exist')
 *
 * Need a new kind of error? Extend AppError and add its code in src/shared/errors.ts.
 */
export class AppError extends Error {
	constructor(
		readonly status: number,
		readonly code: ErrorCode,
		message: string,
		readonly details?: ErrorDetail[],
	) {
		super(message)
		this.name = new.target.name
	}
}

export class BadRequestError extends AppError {
	constructor(message = 'Bad request', details?: ErrorDetail[]) {
		super(400, ErrorCode.BAD_REQUEST, message, details)
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = 'Authentication required') {
		super(401, ErrorCode.UNAUTHORIZED, message)
	}
}

export class ForbiddenError extends AppError {
	constructor(message = 'You do not have permission to perform this action') {
		super(403, ErrorCode.FORBIDDEN, message)
	}
}

/**
 * Same 403, different meaning: the deployment disabled the capability, so no
 * role would help. Clients can tell the two apart via `error.code`.
 */
export class FeatureDisabledError extends AppError {
	constructor(message = 'This feature is disabled') {
		super(403, ErrorCode.FEATURE_DISABLED, message)
	}
}

export class NotFoundError extends AppError {
	constructor(resource = 'Resource') {
		super(404, ErrorCode.NOT_FOUND, `${resource} not found`)
	}
}

export class ConflictError extends AppError {
	constructor(message: string, details?: ErrorDetail[]) {
		super(409, ErrorCode.CONFLICT, message, details)
	}
}

/** Input is well-formed but breaks a business rule (e.g. referenced id does not exist). */
export class UnprocessableEntityError extends AppError {
	constructor(details: ErrorDetail[], message = 'Validation failed') {
		super(422, ErrorCode.VALIDATION_ERROR, message, details)
	}

	static field(field: string, message: string) {
		return new UnprocessableEntityError([{ field, message, location: 'body' }])
	}
}

export class TooManyRequestsError extends AppError {
	constructor(message = 'Too many requests, please try again later') {
		super(429, ErrorCode.TOO_MANY_REQUESTS, message)
	}
}

export class ServiceUnavailableError extends AppError {
	constructor(message = 'Service temporarily unavailable') {
		super(503, ErrorCode.SERVICE_UNAVAILABLE, message)
	}
}

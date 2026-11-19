import { type Static, type TSchema, Type as t } from '@sinclair/typebox'
import { ErrorCode } from './errors'

/**
 * Response envelope shared by the API and its clients.
 *
 *   success → { success: true,  data, meta? }
 *   failure → { success: false, error: { code, message, details?, requestId? } }
 *
 * The envelope is deliberately identical everywhere; what changes per status
 * is the `code` (narrowed to the values that status can carry) and whether
 * `details` exists. Each status gets its own named model so `/docs` shows a
 * 401 and a 422 as different things - a 422 lists every invalid field, a 401
 * never does.
 */

/** One invalid input field. `field` uses dot notation: `title`, `tags.0`, `address.city`. */
export const ErrorDetailSchema = t.Object({
	field: t.String({ description: 'Dot-notation path of the invalid field', examples: ['title'] }),
	message: t.String({ examples: ['Title must be between 3 and 200 characters'] }),
	location: t.Optional(
		t.Union([t.Literal('body'), t.Literal('query'), t.Literal('params'), t.Literal('headers'), t.Literal('cookie')]),
	),
})

type DetailsMode = 'required' | 'optional' | 'none'

function errorEnvelope(code: TSchema, details: DetailsMode, description: string) {
	return t.Object(
		{
			success: t.Literal(false),
			error: t.Object({
				code,
				message: t.String(),
				...(details === 'none'
					? {}
					: {
							details: details === 'required' ? t.Array(ErrorDetailSchema) : t.Optional(t.Array(ErrorDetailSchema)),
						}),
				requestId: t.Optional(t.String({ description: 'Correlates this failure with the server log' })),
			}),
		},
		{ description },
	)
}

export const BadRequestErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.BAD_REQUEST),
	'optional',
	'Malformed request (unparsable JSON body, invalid cookie signature)',
)

export const UnauthorizedErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.UNAUTHORIZED),
	'none',
	'No valid session: sign in or send a bearer token. Never carries field-level details',
)

export const ForbiddenErrorSchema = errorEnvelope(
	t.Union([t.Literal(ErrorCode.FORBIDDEN), t.Literal(ErrorCode.FEATURE_DISABLED)]),
	'none',
	'Authenticated, but not allowed to perform this action - or the feature is switched off on this deployment',
)

export const NotFoundErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.NOT_FOUND),
	'none',
	'The resource (or route) does not exist',
)

export const ConflictErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.CONFLICT),
	'optional',
	'The request conflicts with the current state (duplicate name/slug, resource still in use)',
)

export const ValidationErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.VALIDATION_ERROR),
	'required',
	'Input failed validation. `details` lists every invalid field; an unknown foreign id is also reported here',
)

export const TooManyRequestsErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.TOO_MANY_REQUESTS),
	'none',
	'Rate limit exceeded. Retry after the window from the `Retry-After` header',
)

export const InternalServerErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.INTERNAL_SERVER_ERROR),
	'none',
	'Unhandled failure. `message` is generic in production; use `requestId` to find the log entry',
)

export const ServiceUnavailableErrorSchema = errorEnvelope(
	t.Literal(ErrorCode.SERVICE_UNAVAILABLE),
	'none',
	'A dependency (database, mail, storage) is not available',
)

export const successSchema = <T extends TSchema>(data: T) => t.Object({ success: t.Literal(true), data })

export type ErrorDetail = Static<typeof ErrorDetailSchema>
export type SuccessResponse<T> = { success: true; data: T }

/** Union of every error body this API can return. */
export type ErrorResponse =
	| Static<typeof BadRequestErrorSchema>
	| Static<typeof UnauthorizedErrorSchema>
	| Static<typeof ForbiddenErrorSchema>
	| Static<typeof NotFoundErrorSchema>
	| Static<typeof ConflictErrorSchema>
	| Static<typeof ValidationErrorSchema>
	| Static<typeof TooManyRequestsErrorSchema>
	| Static<typeof InternalServerErrorSchema>
	| Static<typeof ServiceUnavailableErrorSchema>

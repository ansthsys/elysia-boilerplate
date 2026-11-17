import { type Static, type TSchema, Type as t } from '@sinclair/typebox'
import { ErrorCode } from './errors'

/**
 * Response envelope shared by the API and its clients.
 *
 *   success → { success: true,  data, meta? }
 *   failure → { success: false, error: { code, message, details?, requestId? } }
 */

/** One invalid input field. `field` uses dot notation: `title`, `tags.0`, `address.city`. */
export const ErrorDetailSchema = t.Object({
	field: t.String({ description: 'Dot-notation path of the invalid field', examples: ['title'] }),
	message: t.String({ examples: ['Title must be between 3 and 200 characters'] }),
	location: t.Optional(
		t.Union([t.Literal('body'), t.Literal('query'), t.Literal('params'), t.Literal('headers'), t.Literal('cookie')]),
	),
})

export const ErrorResponseSchema = t.Object(
	{
		success: t.Literal(false),
		error: t.Object({
			code: t.Enum(ErrorCode),
			message: t.String(),
			details: t.Optional(t.Array(ErrorDetailSchema)),
			requestId: t.Optional(t.String()),
		}),
	},
	{ description: 'Error envelope' },
)

export const successSchema = <T extends TSchema>(data: T) => t.Object({ success: t.Literal(true), data })

export type ErrorDetail = Static<typeof ErrorDetailSchema>
export type ErrorResponse = Static<typeof ErrorResponseSchema>
export type SuccessResponse<T> = { success: true; data: T }

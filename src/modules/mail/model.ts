import { t } from 'elysia'
import { successSchema } from '#shared'

/** Internal endpoint shapes. The route is hidden from /docs. */
export const MailModel = {
	headers: t.Object({ authorization: t.Optional(t.String()) }),
	drainResponse: successSchema(
		t.Object({
			sent: t.Integer(),
			failed: t.Integer(),
			pending: t.Integer(),
		}),
	),
} as const

export type MailModel = {
	[K in keyof typeof MailModel]: (typeof MailModel)[K]['static']
}

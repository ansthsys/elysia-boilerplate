import { Elysia } from 'elysia'
import { env } from '#config/env'
import { NotFoundError } from '#core/errors'
import { ok } from '#core/http'
import { errorHandler } from '#plugins/error-handler'
import { MailModel } from './model'
import { MailService } from './service'

/**
 * Internal mail drain. Long-running servers use an interval instead; on Vercel
 * a cron job calls this route. Without `CRON_SECRET` the route does not exist
 * (404), so it is safe to leave deployed.
 */
export const mailModule = new Elysia({ prefix: '/api/internal/mail' }).use(errorHandler).get(
	'/drain',
	async ({ headers }) => {
		if (!env.CRON_SECRET || headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
			throw new NotFoundError('Route')
		}
		return ok(await MailService.drain())
	},
	{
		headers: MailModel.headers,
		response: { 200: MailModel.drainResponse },
		detail: { hide: true },
	},
)

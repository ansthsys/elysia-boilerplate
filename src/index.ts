import { env } from '#config/env'
import { database } from '#db/client'
import { logger } from '#lib/logger'
import { MailService } from '#modules/mail/service'
import { app } from './app'

const MAIL_DRAIN_INTERVAL_MS = 10_000

/**
 * Server entry.
 *
 * `export default` is what Vercel (Bun runtime) uses as the handler. The port is
 * only opened for a real long-running process: importing this module in a
 * serverless function must not call `listen` or register process handlers.
 */
export default app

if (import.meta.main && !env.VERCEL) {
	app.listen({ hostname: env.HOST, port: env.PORT })
	logger.info(`Server listening on http://${env.HOST}:${env.PORT} (docs: /docs)`)

	// Long-running servers drain the outbox on an interval. On Vercel there is
	// no timer: a scheduler calls /api/internal/mail/drain instead.
	const drainTimer = setInterval(() => {
		MailService.drain().catch((error) => logger.error({ err: error }, 'Mail drain failed'))
	}, MAIL_DRAIN_INTERVAL_MS)

	let shuttingDown = false
	async function shutdown(signal: string) {
		if (shuttingDown) return
		shuttingDown = true
		clearInterval(drainTimer)
		logger.info(`${signal} received, shutting down`)
		try {
			await MailService.drain().catch((error) => logger.error({ err: error }, 'Final mail drain failed'))
			await app.stop()
			await database.close()
			process.exit(0)
		} catch (error) {
			logger.error({ err: error }, 'Error during shutdown')
			process.exit(1)
		}
	}

	process.on('SIGTERM', () => shutdown('SIGTERM'))
	process.on('SIGINT', () => shutdown('SIGINT'))
}

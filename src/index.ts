import { env } from '#config/env'
import { database } from '#db/client'
import { logger } from '#lib/logger'
import { app } from './app'

/** Process entry: the only place that opens a port. */
app.listen({ hostname: env.HOST, port: env.PORT })
logger.info(`Server listening on http://${env.HOST}:${env.PORT} (docs: /docs)`)

let shuttingDown = false
async function shutdown(signal: string) {
	if (shuttingDown) return
	shuttingDown = true
	logger.info(`${signal} received, shutting down`)
	try {
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

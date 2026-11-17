import pino from 'pino'
import { env, isTest } from '#config/env'

/**
 * Application logger (pino). Structured JSON in production, pretty output in
 * development, silent in tests. Inside a request handler prefer the
 * per-request `log` from context - it carries the request id.
 */
export const logger = pino({
	level: isTest ? 'silent' : env.LOG_LEVEL,
	base: { app: env.APP_NAME },
	redact: ['req.headers.cookie', 'req.headers.authorization', '*.password'],
	transport:
		env.NODE_ENV === 'development'
			? {
					target: 'pino-pretty',
					options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,app' },
				}
			: undefined,
})

export type Logger = typeof logger

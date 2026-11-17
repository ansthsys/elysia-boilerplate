import { ServiceUnavailableError } from '#core/errors'
import { HealthRepository } from './repository'

export abstract class HealthService {
	static async check() {
		const startedAt = performance.now()
		try {
			await HealthRepository.ping()
		} catch {
			throw new ServiceUnavailableError('Database is unreachable')
		}
		return {
			status: 'ok' as const,
			database: { driver: HealthRepository.driver, latencyMs: Math.round(performance.now() - startedAt) },
			uptimeSeconds: Math.round(process.uptime()),
		}
	}
}

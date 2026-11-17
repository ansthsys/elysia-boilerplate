import { database } from '#db/client'
import { dialect } from '#db/dialect'

export abstract class HealthRepository {
	static readonly driver = dialect.name

	/** Round-trips a `select 1`; throws when the database is unreachable. */
	static async ping(): Promise<void> {
		await database.ping()
	}
}

/**
 * Data-layer errors. Repositories translate driver specific errors into these
 * so services can react to them without knowing which database is used.
 */
export class UniqueConstraintError extends Error {
	constructor(cause: unknown) {
		super('Unique constraint violated', { cause })
		this.name = 'UniqueConstraintError'
	}
}

const UNIQUE_VIOLATION_CODES = new Set([
	'23505', // PostgreSQL
	'ER_DUP_ENTRY', // MySQL / MariaDB
	'SQLITE_CONSTRAINT_UNIQUE', // SQLite
	'SQLITE_CONSTRAINT_PRIMARYKEY',
])

/** Drizzle wraps driver errors, so the original error is searched in `cause`. */
export function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error
	for (let depth = 0; current && depth < 5; depth++) {
		const code = (current as { code?: unknown }).code
		if (typeof code === 'string' && UNIQUE_VIOLATION_CODES.has(code)) return true
		current = (current as { cause?: unknown }).cause
	}
	return false
}

/** Runs a write and rethrows unique violations as `UniqueConstraintError`. */
export async function guardUnique<T>(write: () => Promise<T>): Promise<T> {
	try {
		return await write()
	} catch (error) {
		if (isUniqueViolation(error)) throw new UniqueConstraintError(error)
		throw error
	}
}

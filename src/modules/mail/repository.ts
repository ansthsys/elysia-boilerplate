import { and, asc, eq, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '#db/client'
import { newId } from '#db/id'
import { type MailOutboxRecord, mailOutbox, type NewMailOutbox } from '#db/schema/index'

/** Data access for the mail outbox: every Drizzle query of the queue lives here. */
export abstract class MailRepository {
	static async create(values: Omit<NewMailOutbox, 'id'>): Promise<string> {
		const id = newId()
		await db.insert(mailOutbox).values({ ...values, id })
		return id
	}

	/** Pending rows that are due, plus sending rows whose lease expired. */
	static candidates(now: Date, limit: number): Promise<MailOutboxRecord[]> {
		return db.query.mailOutbox.findMany({
			where: or(
				and(eq(mailOutbox.status, 'pending'), lte(mailOutbox.nextAttemptAt, now)),
				and(eq(mailOutbox.status, 'sending'), lt(mailOutbox.lockedUntil, now)),
			),
			orderBy: [asc(mailOutbox.createdAt)],
			limit,
		})
	}

	/**
	 * Takes the lease. Two workers may race here; the owner is decided by reading
	 * `lockId` afterwards (`lockOwner`), not by driver-specific affected-row counts.
	 */
	static async claim(id: string, lockId: string, now: Date, lockedUntil: Date): Promise<void> {
		await db
			.update(mailOutbox)
			.set({
				status: 'sending',
				lockId,
				lockedUntil,
				attempts: sql`${mailOutbox.attempts} + 1`,
			})
			.where(
				and(
					eq(mailOutbox.id, id),
					or(eq(mailOutbox.status, 'pending'), and(eq(mailOutbox.status, 'sending'), lt(mailOutbox.lockedUntil, now))),
				),
			)
	}

	static async lockOwner(id: string): Promise<{ lockId: string | null } | undefined> {
		return db.query.mailOutbox.findFirst({ where: eq(mailOutbox.id, id), columns: { lockId: true } })
	}

	static async markSent(id: string): Promise<void> {
		await db
			.update(mailOutbox)
			.set({ status: 'sent', sentAt: new Date(), lockId: null, lockedUntil: null, lastError: null })
			.where(eq(mailOutbox.id, id))
	}

	static async markRetry(id: string, error: string, nextAttemptAt: Date): Promise<void> {
		await db
			.update(mailOutbox)
			.set({ status: 'pending', lockId: null, lockedUntil: null, lastError: error, nextAttemptAt })
			.where(eq(mailOutbox.id, id))
	}

	static async markFailed(id: string, error: string): Promise<void> {
		await db
			.update(mailOutbox)
			.set({ status: 'failed', lockId: null, lockedUntil: null, lastError: error })
			.where(eq(mailOutbox.id, id))
	}

	static countPending(): Promise<number> {
		return db.$count(mailOutbox, eq(mailOutbox.status, 'pending'))
	}
}

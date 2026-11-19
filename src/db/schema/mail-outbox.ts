import { timestamps } from '../columns'
import { column, index, table } from '../dialect'

/**
 * Durable mail queue (outbox). A request only inserts a row, so sending never
 * blocks the response; a drain pass (interval on a long-running server, cron on
 * Vercel) delivers and retries it.
 */
export const mailOutbox = table(
	'mail_outbox',
	{
		id: column.id(),
		to: column.string('to', 320).notNull(),
		subject: column.string('subject', 255).notNull(),
		text: column.text('text').notNull(),
		html: column.text('html'),
		status: column.enum('status', ['pending', 'sending', 'sent', 'failed']).notNull(),
		attempts: column.integer('attempts').notNull().default(0),
		lastError: column.text('last_error'),
		nextAttemptAt: column.timestamp('next_attempt_at').notNull(),
		/** Lease held by the drain pass that is currently sending this row. */
		lockId: column.string('lock_id', 36),
		lockedUntil: column.timestamp('locked_until'),
		sentAt: column.timestamp('sent_at'),
		...timestamps(),
	},
	(t) => [index('mail_outbox_status_idx').on(t.status, t.nextAttemptAt)],
)

export type MailOutboxRecord = typeof mailOutbox.$inferSelect
export type NewMailOutbox = typeof mailOutbox.$inferInsert

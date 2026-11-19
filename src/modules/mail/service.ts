import { newId } from '#db/id'
import { type Mail, type MailResult, sendMailNow } from '#lib/mailer'
import { MailRepository } from './repository'

const MAX_ATTEMPTS = 5
const LEASE_MS = 60_000
const BASE_BACKOFF_MS = 10_000

type Transport = (mail: Mail) => Promise<MailResult>

/**
 * Mail queue. `queue` only inserts a row, so a request never waits for the
 * provider; `drain` delivers due rows and retries with exponential backoff.
 *
 * Long-running servers call `drain` on an interval (see `src/index.ts`); Vercel
 * calls the hidden `/api/internal/mail/drain` endpoint from a cron job.
 */
export abstract class MailService {
	static queue(mail: Mail): Promise<string> {
		return MailRepository.create({
			to: mail.to,
			subject: mail.subject,
			text: mail.text,
			html: mail.html ?? null,
			status: 'pending',
			attempts: 0,
			nextAttemptAt: new Date(),
		})
	}

	static async drain(options: { limit?: number; transport?: Transport } = {}) {
		const limit = options.limit ?? 20
		const transport = options.transport ?? sendMailNow
		const now = new Date()
		const candidates = await MailRepository.candidates(now, limit)

		let sent = 0
		let failed = 0

		for (const row of candidates) {
			const lockId = newId()
			await MailRepository.claim(row.id, lockId, now, new Date(Date.now() + LEASE_MS))

			const owner = await MailRepository.lockOwner(row.id)
			if (owner?.lockId !== lockId) continue // another worker won the race

			const mail: Mail = {
				to: row.to,
				subject: row.subject,
				text: row.text,
				...(row.html ? { html: row.html } : {}),
			}

			try {
				const result = await transport(mail)
				if (!result.delivered) throw result.error ?? new Error('Email delivery failed')
				await MailRepository.markSent(row.id)
				sent++
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				const attempts = row.attempts + 1
				if (attempts >= MAX_ATTEMPTS) {
					await MailRepository.markFailed(row.id, message)
					failed++
				} else {
					const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempts, 3_600_000)
					await MailRepository.markRetry(row.id, message, new Date(Date.now() + delay))
				}
			}
		}

		return { sent, failed, pending: await MailRepository.countPending() }
	}
}

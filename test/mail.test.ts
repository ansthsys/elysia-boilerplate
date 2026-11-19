import { describe, expect, it } from 'bun:test'
import { app } from '#app'
import { env } from '#config/env'
import { formatMail } from '#lib/mailer'
import { MailService } from '#modules/mail/service'

describe('mail queue', () => {
	it('delivers a queued message through the drain', async () => {
		const id = await MailService.queue({
			to: 'queue@example.com',
			subject: 'Queued message',
			text: 'Hello from the queue',
			html: '<p>Hello from the queue</p>',
		})
		const delivered: string[] = []

		const result = await MailService.drain({
			transport: async (mail) => {
				delivered.push(`${mail.to}:${mail.subject}`)
				return { delivered: true, via: 'console' }
			},
		})

		expect(id).toBeString()
		expect(delivered).toContain('queue@example.com:Queued message')
		expect(result.sent).toBeGreaterThanOrEqual(1)
	})

	it('keeps a failed message in the queue for a retry', async () => {
		await MailService.queue({ to: 'retry@example.com', subject: 'Retry me', text: 'x' })

		const result = await MailService.drain({
			transport: async () => ({ delivered: false, reason: 'provider-error', error: new Error('boom') }),
		})

		// Not lost: it is pending again, with backoff.
		expect(result.pending).toBeGreaterThanOrEqual(1)
	})

	it('formats the console fallback with text and html', () => {
		const output = formatMail({ to: 'a@example.com', subject: 'Hello', text: 'plain body', html: '<p>html body</p>' })

		expect(output).toContain('To: a@example.com')
		expect(output).toContain('plain body')
		expect(output).toContain('<p>html body</p>')
	})
})

describe('internal drain endpoint', () => {
	const call = (headers: Record<string, string>) =>
		app.handle(new Request('http://localhost/api/internal/mail/drain', { headers }))

	it('is hidden without a secret (404)', async () => {
		expect((await call({})).status).toBe(404)
	})

	it('drains with the cron secret', async () => {
		expect(env.CRON_SECRET).toBeString()
		const response = await call({ authorization: `Bearer ${env.CRON_SECRET}` })

		expect(response.status).toBe(200)
	})
})

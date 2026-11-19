import { Resend } from 'resend'
import { env } from '#config/env'
import { logger } from '#lib/logger'

export interface Mail {
	to: string
	subject: string
	text: string
	/** Optional: text-only mail is valid. */
	html?: string
}

export type MailResult =
	| { delivered: true; via: 'resend' | 'console' }
	| { delivered: false; reason: 'provider-error'; error: unknown }

interface MailTransport {
	send(mail: Mail): Promise<{ error?: unknown }>
}

/** Escapes interpolated user content in HTML templates. */
export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

/**
 * Human-readable dump of a message, including the HTML. Used by the console
 * transport and whenever the provider fails, so reset links are never lost.
 */
export function formatMail(mail: Mail): string {
	return [
		'--- email (not delivered) ---',
		`To: ${mail.to}`,
		`Subject: ${mail.subject}`,
		'',
		mail.text,
		...(mail.html ? ['', '--- html ---', mail.html] : []),
	].join('\n')
}

export function createMailer(transport: MailTransport) {
	return async (mail: Mail): Promise<MailResult> => {
		const { error } = await transport.send(mail)
		if (error) {
			logger.error({ error }, formatMail(mail))
			return { delivered: false, reason: 'provider-error', error }
		}
		return { delivered: true, via: 'resend' }
	}
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

/**
 * Sends immediately. The queue (`MailService`) is the normal path; this is used
 * by the drain worker and tests.
 *
 * Without `RESEND_API_KEY` the full message (text and html) is printed to the
 * terminal, so verification/reset links stay usable in development.
 */
export async function sendMailNow(mail: Mail): Promise<MailResult> {
	if (!resend) {
		logger.info(formatMail(mail))
		return { delivered: true, via: 'console' }
	}

	return createMailer({
		send: (message) => resend.emails.send({ from: env.EMAIL_FROM, ...message }),
	})(mail)
}

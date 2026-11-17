import { Resend } from 'resend'
import { env } from '#config/env'
import { logger } from '#lib/logger'

export interface Mail {
	to: string
	subject: string
	html: string
	text: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

/**
 * Sends an email through Resend. Without `RESEND_API_KEY` the email is only
 * logged, so auth flows (verification, reset password) work in development.
 */
export async function sendMail(mail: Mail): Promise<void> {
	if (!resend) {
		logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'Email (not sent: RESEND_API_KEY missing)')
		return
	}

	const { error } = await resend.emails.send({ from: env.EMAIL_FROM, ...mail })
	if (error) logger.error({ to: mail.to, subject: mail.subject, error }, 'Failed to send email')
}

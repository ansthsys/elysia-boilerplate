import { Elysia } from 'elysia'
import { isProduction } from '#config/env'

/**
 * Baseline security headers on every response, including errors and 404s.
 * A Content-Security-Policy is not set: this API returns JSON, and a strict
 * policy would break the Scalar UI served at /docs. Add one at the reverse
 * proxy if you serve HTML from the same origin.
 *
 * `onRequest` runs before routing for every request, so no scope is needed.
 */
const headers: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'no-referrer',
	...(isProduction && { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }),
}

export const securityHeaders = new Elysia({ name: 'plugin.security-headers' }).onRequest(({ set }) => {
	Object.assign(set.headers, headers)
})

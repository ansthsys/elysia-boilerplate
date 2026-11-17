import { describe, expect, it } from 'bun:test'
import { app } from '#app'

const get = (path: string, headers?: Record<string, string>) =>
	app.handle(new Request(`http://localhost${path}`, { headers }))

describe('security headers', () => {
	it.each(['/health', '/does-not-exist', '/api/auth/get-session'])('are set on %s', async (path) => {
		const response = await get(path)

		expect(response.headers.get('x-content-type-options')).toBe('nosniff')
		expect(response.headers.get('x-frame-options')).toBe('DENY')
		expect(response.headers.get('referrer-policy')).toBe('no-referrer')
	})
})

describe('x-request-id', () => {
	it('generates an id when the caller sends none', async () => {
		const response = await get('/health')
		expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
	})

	it('reuses a well-formed id from the caller (e.g. a proxy)', async () => {
		const response = await get('/health', { 'x-request-id': 'edge-123.abc' })
		expect(response.headers.get('x-request-id')).toBe('edge-123.abc')
	})

	it.each([
		['too long', 'x'.repeat(129)],
		['unsafe characters', 'abc\u0001<script>'],
	])('replaces an id that is %s', async (_case, incoming) => {
		const response = await get('/health', { 'x-request-id': incoming })
		expect(response.headers.get('x-request-id')).not.toBe(incoming)
		expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
	})

	it('is included in error responses', async () => {
		const response = await app.handle(
			new Request('http://localhost/api/posts', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-request-id': 'trace-42' },
				body: '{}',
			}),
		)
		const body = (await response.json()) as { error: { requestId?: string } }
		expect(body.error.requestId).toBe('trace-42')
	})
})

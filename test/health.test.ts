import { describe, expect, it } from 'bun:test'
import { api } from './helpers'

describe('GET /health', () => {
	it('reports the database driver', async () => {
		const { data, status } = await api.health.get()

		expect(status).toBe(200)
		expect(data?.data.status).toBe('ok')
		expect(data?.data.database.driver).toBeString()
	})
})

describe('error envelope', () => {
	it('returns 404 for unknown routes', async () => {
		const response = await (await import('#app')).app.handle(new Request('http://localhost/does-not-exist'))
		const body = await response.json()

		expect(response.status).toBe(404)
		expect(body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
	})

	it('returns 400 for malformed JSON', async () => {
		const response = await (await import('#app')).app.handle(
			new Request('http://localhost/api/posts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{not json',
			}),
		)

		expect(response.status).toBe(400)
		const body = (await response.json()) as { error: { code: string } }
		expect(body.error.code).toBe('BAD_REQUEST')
	})
})

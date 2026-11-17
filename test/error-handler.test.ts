import { describe, expect, it } from 'bun:test'
import { Elysia, status, t } from 'elysia'
import { ConflictError } from '#core/errors'
import { errorHandler } from '#plugins/error-handler'

/** A throwaway app: exercises the plugin without depending on real routes. */
const app = new Elysia()
	.use(errorHandler)
	.get('/app-error', () => {
		throw new ConflictError('Slug taken', [{ field: 'slug', message: 'Already used' }])
	})
	.get('/elysia-status', () => {
		throw status(409, 'Already done')
	})
	.get('/crash', () => {
		throw new Error('database password leaked here')
	})
	.get('/bad-response', () => ({ id: 'not-a-number' }) as unknown as { id: number }, {
		response: t.Object({ id: t.Number() }),
	})

const call = async (path: string) => {
	const response = await app.handle(new Request(`http://localhost${path}`))
	return { status: response.status, body: (await response.json()) as { error: Record<string, unknown> } }
}

describe('error handler', () => {
	it('maps AppError subclasses with their details', async () => {
		const { status: code, body } = await call('/app-error')
		expect(code).toBe(409)
		expect(body.error).toEqual({
			code: 'CONFLICT',
			message: 'Slug taken',
			details: [{ field: 'slug', message: 'Already used' }],
		})
	})

	it("maps Elysia's `throw status()`", async () => {
		const { status: code, body } = await call('/elysia-status')
		expect(code).toBe(409)
		expect(body.error).toEqual({ code: 'CONFLICT', message: 'Already done' })
	})

	it('turns unexpected errors into 500', async () => {
		const { status: code, body } = await call('/crash')
		expect(code).toBe(500)
		expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
	})

	it('treats an invalid response as a server bug (500), not a client error (422)', async () => {
		const { status: code, body } = await call('/bad-response')
		expect(code).toBe(500)
		expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
	})
})

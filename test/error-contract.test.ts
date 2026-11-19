import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { app } from '#app'
import {
	BadRequestErrorSchema,
	ConflictErrorSchema,
	ForbiddenErrorSchema,
	NotFoundErrorSchema,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
} from '#shared'
import { actingAs, createCategory } from './helpers'

/**
 * Runtime side of the contract: every reachable error path is validated
 * against the schema the spec advertises. If the handler starts returning a
 * different body, or a schema is tightened beyond what the handler produces,
 * one of these fails.
 */
const call = async (path: string, init?: RequestInit) => {
	const response = await app.handle(new Request(`http://localhost${path}`, init))
	return { status: response.status, body: (await response.json()) as unknown }
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
	method: 'POST',
	headers: { 'content-type': 'application/json', ...headers },
	body: JSON.stringify(body),
})

describe('error response contract', () => {
	it('400 malformed JSON', async () => {
		const { status, body } = await call('/api/posts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{',
		})

		expect(status).toBe(400)
		expect(Value.Check(BadRequestErrorSchema, body)).toBe(true)
	})

	it('401 without a session', async () => {
		// A body that passes validation: Elysia validates before the guard runs,
		// so an invalid body would (correctly) be a 422 even without a session.
		const { status, body } = await call(
			'/api/posts',
			json({
				title: 'Valid title',
				content: 'Long enough content for the validator.',
				categoryId: '01900000-0000-7000-8000-000000000000',
			}),
		)
		const parsed = body as { error: Record<string, unknown> }

		expect(status).toBe(401)
		expect(Value.Check(UnauthorizedErrorSchema, body)).toBe(true)
		expect(parsed.error.code).toBe('UNAUTHORIZED')
		expect(parsed.error).not.toHaveProperty('details')
	})

	it('403 with an insufficient role', async () => {
		const { headers } = await actingAs('member')
		const { status, body } = await call('/api/admin/stats', { headers })

		expect(status).toBe(403)
		expect(Value.Check(ForbiddenErrorSchema, body)).toBe(true)
		expect((body as { error: { code: string } }).error.code).toBe('FORBIDDEN')
	})

	it('404 for a missing resource and for an unknown route', async () => {
		const post = await call('/api/posts/01900000-0000-7000-8000-000000000000')
		expect(post.status).toBe(404)
		expect(Value.Check(NotFoundErrorSchema, post.body)).toBe(true)

		const route = await call('/nope')
		expect(route.status).toBe(404)
		expect(Value.Check(NotFoundErrorSchema, route.body)).toBe(true)
	})

	it('409 with field-level details', async () => {
		const admin = await actingAs('admin')
		const category = await createCategory()
		const { status, body } = await call(
			'/api/categories',
			json({ name: category.name, slug: category.slug }, admin.headers),
		)

		expect(status).toBe(409)
		expect(Value.Check(ConflictErrorSchema, body)).toBe(true)
		expect((body as { error: { details: { field: string }[] } }).error.details.map((d) => d.field)).toEqual([
			'name',
			'slug',
		])
	})

	it('422 from the body, the query and a business rule', async () => {
		const { headers } = await actingAs('member')
		const category = await createCategory()

		const body = await call('/api/posts', json({ title: 'x' }, headers))
		expect(body.status).toBe(422)
		expect(Value.Check(ValidationErrorSchema, body.body)).toBe(true)
		expect((body.body as { error: { details: unknown[] } }).error.details.length).toBeGreaterThan(0)

		const query = await call('/api/posts?page=abc')
		expect(query.status).toBe(422)
		expect(Value.Check(ValidationErrorSchema, query.body)).toBe(true)

		const business = await call(
			'/api/posts',
			json(
				{
					title: 'Valid title',
					content: 'Long enough content for the validator.',
					categoryId: '01900000-0000-7000-8000-000000000000',
				},
				headers,
			),
		)
		expect(business.status).toBe(422)
		expect(Value.Check(ValidationErrorSchema, business.body)).toBe(true)
		expect((business.body as { error: { details: { field: string }[] } }).error.details[0]?.field).toBe('categoryId')
		expect(category.id).toBeDefined()
	})
})

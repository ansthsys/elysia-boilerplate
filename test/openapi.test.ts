import { describe, expect, it } from 'bun:test'
import { app } from '#app'

/**
 * The spec is a contract: if it says a route returns 401 with the
 * `UnauthorizedError` shape, the runtime must produce exactly that. These
 * assertions are what stop `errorResponses(...)` from drifting again.
 */
interface Operation {
	responses: Record<string, { content?: { 'application/json'?: { schema?: { $ref?: string } } } }>
}
interface Spec {
	paths: Record<string, Record<string, Operation>>
	components: {
		schemas: Record<
			string,
			{ properties: { error: { required: string[]; properties: { code: { anyOf?: unknown[]; const?: string } } } } }
		>
	}
}

const loadSpec = async (): Promise<Spec> => {
	const response = await app.handle(new Request('http://localhost/docs/json'))
	expect(response.status).toBe(200)
	return (await response.json()) as Spec
}

const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head'])

const refOf = (operation: Operation, status: number) =>
	operation.responses[String(status)]?.content?.['application/json']?.schema?.$ref

describe('OpenAPI error documentation', () => {
	it('registers one named model per error status', async () => {
		const { components } = await loadSpec()

		for (const model of [
			'BadRequestError',
			'UnauthorizedError',
			'ForbiddenError',
			'NotFoundError',
			'ConflictError',
			'ValidationError',
			'TooManyRequestsError',
			'InternalServerError',
			'ServiceUnavailableError',
		]) {
			expect({ model, present: model in components.schemas }).toEqual({ model, present: true })
		}
	})

	it('points each status at its own model (401 and 422 are not the same shape)', async () => {
		const spec = await loadSpec()
		const post = spec.paths['/api/posts']?.post
		expect(post).toBeDefined()

		expect(refOf(post as Operation, 401)).toBe('#/components/schemas/UnauthorizedError')
		expect(refOf(post as Operation, 422)).toBe('#/components/schemas/ValidationError')
		expect(refOf(post as Operation, 429)).toBe('#/components/schemas/TooManyRequestsError')
		expect(refOf(post as Operation, 500)).toBe('#/components/schemas/InternalServerError')
	})

	it('422 requires details; 401/404/429/500 do not', async () => {
		const { components } = await loadSpec()
		const schemas = components.schemas

		expect(schemas.ValidationError?.properties.error.required).toContain('details')
		for (const model of ['UnauthorizedError', 'NotFoundError', 'TooManyRequestsError', 'InternalServerError']) {
			expect({ model, required: schemas[model]?.properties.error.required }).not.toEqual({
				model,
				required: expect.arrayContaining(['details']),
			})
		}
	})

	it('403 can carry both FORBIDDEN and FEATURE_DISABLED', async () => {
		const { components } = await loadSpec()
		const codes = JSON.stringify(components.schemas.ForbiddenError?.properties.error.properties.code)

		expect(codes).toContain('FORBIDDEN')
		expect(codes).toContain('FEATURE_DISABLED')
	})

	it('every project route documents 429 and 500', async () => {
		const { paths } = await loadSpec()
		const missing: string[] = []

		for (const [path, operations] of Object.entries(paths)) {
			if (path.startsWith('/api/auth')) continue // Better Auth's own shapes
			for (const [verb, operation] of Object.entries(operations)) {
				if (!VERBS.has(verb)) continue
				if (!operation.responses['429'] || !operation.responses['500']) missing.push(`${verb.toUpperCase()} ${path}`)
			}
		}

		expect(missing).toEqual([])
	})

	it('documents Better Auth paths under the Auth tag', async () => {
		const { paths } = await loadSpec()
		const authPaths = Object.keys(paths).filter((path) => path.startsWith('/api/auth/'))

		expect(authPaths).toContain('/api/auth/sign-in/email')
		expect(authPaths).toContain('/api/auth/sign-up/email')
	})
})

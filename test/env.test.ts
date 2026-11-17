import { describe, expect, it } from 'bun:test'
import { loadEnv } from '#config/env'

const base = {
	DATABASE_URL: 'postgresql://user@localhost/app',
	BETTER_AUTH_SECRET: 'a-real-secret-that-is-long-enough-0123456789',
}

describe('environment rules', () => {
	it('converts strings to numbers and booleans', () => {
		const env = loadEnv({ ...base, PORT: '8080', AUTH_ENABLED: 'false' })
		expect(env.PORT).toBe(8080)
		expect(env.AUTH_ENABLED).toBe(false)
	})

	it('lists every invalid variable', () => {
		expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*PORT/)
	})

	it('serves API docs by default outside production only', () => {
		expect(loadEnv({ ...base, NODE_ENV: 'development' }).OPENAPI_ENABLED).toBe(true)
		expect(loadEnv({ ...base, NODE_ENV: 'production' }).OPENAPI_ENABLED).toBe(false)
		expect(loadEnv({ ...base, NODE_ENV: 'production', OPENAPI_ENABLED: 'true' }).OPENAPI_ENABLED).toBe(true)
	})

	it('rejects secrets that are too short', () => {
		expect(() => loadEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/)
	})

	it('rejects the secret published in .env.example in production', () => {
		const example = { ...base, BETTER_AUTH_SECRET: 'replace-with-a-random-string-of-32-chars-or-more' }
		expect(() => loadEnv({ ...example, NODE_ENV: 'production' })).toThrow(/public example value/)
		expect(() => loadEnv({ ...example, NODE_ENV: 'development' })).not.toThrow()
	})
})

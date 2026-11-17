import { type Static, Type as t } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

/**
 * Environment variables - validated once at startup (fail fast).
 *
 * Add a variable: declare it here (with a default when it is optional),
 * then document it in `.env.example`. Never read `process.env` elsewhere.
 *
 * Plain TypeBox (not Elysia's `t`) on purpose: Elysia's `t.Boolean`/`t.Integer`
 * also accept strings, so "false" would pass as a truthy string instead of
 * being converted to `false`.
 */
const bool = (defaultValue: boolean, description: string) => t.Boolean({ default: defaultValue, description })

const EnvSchema = t.Object({
	NODE_ENV: t.Union([t.Literal('development'), t.Literal('production'), t.Literal('test')], {
		default: 'development',
	}),
	HOST: t.String({ default: '0.0.0.0' }),
	PORT: t.Integer({ default: 3000 }),
	APP_NAME: t.String({ default: 'Elysia Boilerplate' }),
	/** Public URL of this API (used in emails and auth callbacks). */
	APP_URL: t.String({ default: 'http://localhost:3000', pattern: '^https?://' }),
	LOG_LEVEL: t.Union(
		['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].map((level) => t.Literal(level)),
		{ default: 'info' },
	),

	/** Connection string for the driver selected in `src/db/dialect.ts`. */
	DATABASE_URL: t.String({ minLength: 1 }),

	/** Comma separated list of allowed browser origins. */
	CORS_ORIGINS: t.String({ default: 'http://localhost:5173' }),

	/** Feature switches - see README "Feature switches". */
	AUTH_ENABLED: bool(true, 'Mount /api/auth and allow protected routes'),
	AUTH_ROLES_ENABLED: bool(true, 'Enable Better Auth admin plugin (roles & permissions)'),
	AUTH_BEARER_ENABLED: bool(false, 'Enable Better Auth bearer plugin (Authorization header sessions)'),
	AUTH_REQUIRE_EMAIL_VERIFICATION: bool(false, 'Block sign-in until the email is verified'),
	BETTER_AUTH_SECRET: t.String({ minLength: 32 }),

	RATE_LIMIT_ENABLED: bool(true, 'Global per-IP rate limit'),
	RATE_LIMIT_MAX: t.Integer({ default: 100, minimum: 1 }),
	RATE_LIMIT_WINDOW_MS: t.Integer({ default: 60_000, minimum: 1 }),
	/** Read the client IP from X-Forwarded-For (only behind a trusted reverse proxy). */
	TRUST_PROXY: bool(false, 'Trust X-Forwarded-For for the client IP'),

	/** Defaults to false when NODE_ENV=production (see loadEnv). */
	OPENAPI_ENABLED: bool(true, 'Serve API docs at /docs'),

	/** Without a key, emails are written to the log instead of being sent. */
	RESEND_API_KEY: t.Optional(t.String()),
	EMAIL_FROM: t.String({ default: 'Elysia Boilerplate <noreply@example.com>' }),
})

export type Env = Static<typeof EnvSchema>

/** Secrets published in this repository (.env.example, CI). Never valid in production. */
const PUBLIC_SECRETS = new Set([
	'replace-with-a-random-string-of-32-chars-or-more',
	'test-secret-that-is-at-least-32-characters-long',
	'ci-secret-that-is-at-least-32-characters-long',
])

/** Exported for tests; the app uses `env` below. */
export function loadEnv(source: Record<string, string | undefined>): Env {
	const production = source.NODE_ENV === 'production'
	// Defaults that depend on the environment: API docs are opt-in in production.
	const withDefaults = { OPENAPI_ENABLED: production ? 'false' : 'true', ...source }

	const value = Value.Convert(EnvSchema, Value.Default(EnvSchema, Value.Clean(EnvSchema, withDefaults)))
	const problems = [...Value.Errors(EnvSchema, value)].map((error) => `${error.path.slice(1)}: ${error.message}`)

	if (production && PUBLIC_SECRETS.has(String(source.BETTER_AUTH_SECRET))) {
		problems.push('BETTER_AUTH_SECRET: uses a public example value; generate one with `openssl rand -base64 32`')
	}
	if (problems.length === 0 && Value.Check(EnvSchema, value)) return value

	throw new Error(`Invalid environment variables:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
}

export const env = loadEnv(process.env)

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
export const corsOrigins = env.CORS_ORIGINS.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean)

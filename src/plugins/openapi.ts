import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { env, isProduction } from '#config/env'
import { auth } from '#lib/auth'
import { isAuthPathDisabled } from '#lib/auth-features'
import pkg from '../../package.json'

/**
 * API documentation at /docs (Scalar UI) and /docs/json (OpenAPI spec).
 *
 * Our routes are documented from their schemas (`body`, `query`, `params`,
 * `response`) and `detail`. Better Auth's routes come from its own OpenAPI
 * generator and are merged in under the "Auth" tag.
 */
async function betterAuthDocs() {
	if (!env.AUTH_ENABLED) return { paths: {}, components: {} }

	const { paths, components } = await auth.api.generateOpenAPISchema()
	const prefixed: Record<string, unknown> = {}
	for (const [path, operations] of Object.entries(paths)) {
		const fullPath = `/api/auth${path}`
		// A switched-off endpoint is a 404 at runtime: never advertise it.
		if (isAuthPathDisabled(fullPath)) continue
		for (const operation of Object.values(operations as Record<string, { tags?: string[] }>)) {
			operation.tags = ['Auth']
		}
		prefixed[fullPath] = operations
	}
	return { paths: prefixed, components }
}

/** Generating Better Auth's schema is not free: skip it entirely when docs are off (production default). */
const authDocs = env.OPENAPI_ENABLED ? await betterAuthDocs() : { paths: {}, components: {} }

export const openapiPlugin = new Elysia({ name: 'plugin.openapi' }).use(
	openapi({
		enabled: env.OPENAPI_ENABLED,
		path: '/docs',
		documentation: {
			info: {
				title: env.APP_NAME,
				version: pkg.version,
				description: [
					'Every response uses the same envelope:',
					'- success: `{ success: true, data, meta? }`',
					'- failure: `{ success: false, error: { code, message, details?, requestId? } }`',
					'',
					'Each failure status has its own schema, so the docs do not blur them together:',
					'- 422 always carries `error.details`, one entry per invalid field (`{ field, message, location }`);',
					'- 409 carries `details` when the conflict is field-specific (e.g. duplicate slug);',
					'- 401 / 403 / 404 / 429 / 500 never carry `details`, and each pins `error.code` to the values that status can have.',
					'',
					'429 and 500 are documented on every route: the global rate limiter and the error fallthrough can reach any endpoint.',
					'Protected routes need the session cookie set by `POST /api/auth/sign-in/email`.',
				].join('\n'),
			},
			tags: [
				{ name: 'Health', description: 'Service status' },
				{ name: 'Auth', description: 'Authentication by Better Auth (its own response format)' },
				{ name: 'Categories', description: 'Example: unpaginated list, admin-only writes (permission macro)' },
				{ name: 'Posts', description: 'Example: paginated list, ownership + permission rules' },
				{ name: 'Files', description: 'Example: storage through a driver (local filesystem or S3)' },
				{ name: 'Admin', description: 'Example: role macro' },
			],
			components: {
				...(authDocs.components as object),
				securitySchemes: {
					sessionCookie: {
						type: 'apiKey',
						in: 'cookie',
						// Better Auth prefixes the cookie with __Secure- when secure cookies are on,
						// which is exactly when NODE_ENV=production (see src/lib/auth.ts).
						name: isProduction ? '__Secure-better-auth.session_token' : 'better-auth.session_token',
					},
					...(env.AUTH_BEARER_ENABLED ? { bearerAuth: { type: 'http' as const, scheme: 'bearer' as const } } : {}),
				},
			},
			// Better Auth's generated paths are plain OpenAPI objects; the plugin's
			// stricter OpenAPI types cannot describe them, hence the cast.
			paths: authDocs.paths as never,
		},
	}),
)

import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { env } from '#config/env'
import { auth } from '#lib/auth'
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
		for (const operation of Object.values(operations as Record<string, { tags?: string[] }>)) {
			operation.tags = ['Auth']
		}
		prefixed[`/api/auth${path}`] = operations
	}
	return { paths: prefixed, components }
}

const authDocs = await betterAuthDocs()

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
					'Validation errors (422) list each invalid field in `error.details` as `{ field, message, location }`.',
					'Protected routes need the session cookie set by `POST /api/auth/sign-in/email`.',
				].join('\n'),
			},
			tags: [
				{ name: 'Health', description: 'Service status' },
				{ name: 'Auth', description: 'Authentication by Better Auth (its own response format)' },
				{ name: 'Categories', description: 'Example: unpaginated list, admin-only writes (permission macro)' },
				{ name: 'Posts', description: 'Example: paginated list, ownership + permission rules' },
				{ name: 'Admin', description: 'Example: role macro' },
			],
			components: {
				...(authDocs.components as object),
				securitySchemes: {
					sessionCookie: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
					bearerAuth: {
						type: 'http',
						scheme: 'bearer',
						description: 'Requires AUTH_BEARER_ENABLED=true',
					},
				},
			},
			// Better Auth's generated paths are plain OpenAPI objects; the plugin's
			// stricter OpenAPI types cannot describe them, hence the cast.
			paths: authDocs.paths as never,
		},
	}),
)

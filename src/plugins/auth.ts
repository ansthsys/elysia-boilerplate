import { Elysia } from 'elysia'
import { env } from '#config/env'
import { ForbiddenError, NotFoundError, UnauthorizedError } from '#core/errors'
import { auth } from '#lib/auth'
import { hasPermission, hasRole, type Permissions, type Role } from '#shared'

/** Must match the security schemes registered in plugins/openapi.ts. */
const security: Record<string, string[]>[] = [{ sessionCookie: [] }, { bearerAuth: [] }]

async function requireSession(headers: Headers) {
	const session = env.AUTH_ENABLED ? await auth.api.getSession({ headers }) : null
	if (!session) throw new UnauthorizedError()
	return { user: session.user, session: session.session }
}

/** Roles switched off → role/permission protected routes fail closed (403). */
function assertRolesEnabled() {
	if (!env.AUTH_ROLES_ENABLED) throw new ForbiddenError('Role-based access control is disabled')
}

/**
 * Route guards as macros. Add the option to a route and the handler receives
 * a fully typed `user` and `session`:
 *
 *   .get('/me', ({ user }) => user, { auth: true })
 *   .delete('/x', handler, { role: 'admin' })
 *   .post('/categories', handler, { permission: { category: ['create'] } })
 *
 * `resolve` runs after validation and only on routes that opt in, so public
 * routes never pay for a session lookup.
 */
export const authGuard = new Elysia({ name: 'plugin.auth-guard' }).macro({
	auth: {
		detail: { security },
		resolve: ({ request }) => requireSession(request.headers),
	},
	role: (allowed: Role | Role[]) => ({
		detail: { security },
		async resolve({ request }) {
			const session = await requireSession(request.headers)
			assertRolesEnabled()
			if (!hasRole(session.user.role, allowed)) throw new ForbiddenError()
			return session
		},
	}),
	permission: (permissions: Permissions) => ({
		detail: { security },
		async resolve({ request }) {
			const session = await requireSession(request.headers)
			assertRolesEnabled()
			if (!hasPermission(session.user.role, permissions)) throw new ForbiddenError()
			return session
		},
	}),
})

/**
 * Better Auth's own endpoints (/api/auth/*: sign-up, sign-in, sign-out,
 * session, password reset, admin...). Documented in /docs from Better Auth's
 * OpenAPI schema.
 *
 * `parse: 'none'` leaves the body untouched for Better Auth. A plain
 * `.mount(auth.handler)` is avoided on purpose: mounted at the root it would
 * also catch every unknown route and bypass our 404 response.
 */
export const authRoutes = new Elysia({ name: 'plugin.auth-routes' }).all(
	'/api/auth/*',
	({ request }) => {
		if (!env.AUTH_ENABLED) throw new NotFoundError('Route')
		return auth.handler(request)
	},
	{ parse: 'none', detail: { hide: true } },
)

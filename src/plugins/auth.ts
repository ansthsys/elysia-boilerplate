import { Elysia } from 'elysia'
import { env } from '#config/env'
import { FeatureDisabledError, ForbiddenError, NotFoundError, UnauthorizedError } from '#core/errors'
import { auth } from '#lib/auth'
import { isAuthPathDisabled } from '#lib/auth-features'
import { hasPermission, hasRole, type Permissions, type Role } from '#shared'

/**
 * Must match the security schemes registered in plugins/openapi.ts.
 * `bearerAuth` is advertised only when the bearer plugin is actually loaded,
 * otherwise /docs would offer a field that always returns 401.
 */
const security: Record<string, string[]>[] = [
	{ sessionCookie: [] },
	...(env.AUTH_BEARER_ENABLED ? [{ bearerAuth: [] }] : []),
]

async function requireSession(headers: Headers) {
	const session = env.AUTH_ENABLED ? await auth.api.getSession({ headers }) : null
	if (!session) throw new UnauthorizedError()
	return { user: session.user, session: session.session }
}

/** Roles switched off → role/permission protected routes fail closed (403 FEATURE_DISABLED). */
function assertRolesEnabled() {
	if (!env.AUTH_ROLES_ENABLED) throw new FeatureDisabledError('Role-based access control is disabled')
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
 * Hidden paths come from `#lib/auth-features`; the same list filters `/docs`.
 * `parse: 'none'` leaves the body untouched for Better Auth. A plain
 * `.mount(auth.handler)` is avoided on purpose: mounted at the root it would
 * also catch every unknown route and bypass our 404 response.
 */
export const authRoutes = new Elysia({ name: 'plugin.auth-routes' }).all(
	'/api/auth/*',
	({ request }) => {
		const { pathname } = new URL(request.url)
		if (!env.AUTH_ENABLED || isAuthPathDisabled(pathname)) throw new NotFoundError('Route')
		return auth.handler(request)
	},
	{ parse: 'none', detail: { hide: true } },
)

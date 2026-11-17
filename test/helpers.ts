import { treaty } from '@elysiajs/eden'
import { app } from '#app'
import { categoryFactory, userFactory } from '#db/factories/index'
import { auth } from '#lib/auth'
import type { Role } from '#shared'

/**
 * Typed client bound to the app instance: no server, no port. Every call is
 * fully typed from the routes - body, query, response `data` and `error`.
 *
 *   const { data, error, status } = await api.api.posts.get({ query: { page: 1 } })
 */
export const api = treaty(app)

/** Signs in through Better Auth and returns the `cookie` header to send. */
export async function signIn(email: string, password: string) {
	const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
	const cookie = headers
		.getSetCookie()
		.map((entry) => entry.split(';')[0])
		.join('; ')
	return { cookie }
}

/** Creates a user with the given role and returns it with ready-to-use headers. */
export async function actingAs(role: Role = 'member') {
	const user = await userFactory.create({ role })
	const headers = await signIn(user.email, user.password)
	return { user, headers }
}

export const createCategory = () => categoryFactory.create()

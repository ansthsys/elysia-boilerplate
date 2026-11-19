/**
 * Runs in a child process so feature switches can be changed through the
 * environment (they are read once at startup). Prints one JSON line.
 */
import { app } from '#app'
import { categoryFactory, postFactory } from '#db/factories/index'
import { actingAs } from '../helpers'

const request = async (path: string, init?: RequestInit) => {
	const response = await app.handle(new Request(`http://localhost${path}`, init))
	const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null
	return { status: response.status, code: body?.error?.code ?? null }
}

const post = (path: string, payload: unknown, headers: Record<string, string> = {}) =>
	request(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(payload),
	})

const authEnabled = process.env.AUTH_ENABLED !== 'false'
const admin = authEnabled ? await actingAs('admin') : null
const member = authEnabled ? await actingAs('member') : null
const category = await categoryFactory.create()
const memberPost = member ? await postFactory.create({ authorId: member.user.id, categoryId: category.id }) : null

const roleRoute = await request('/api/admin/stats', { headers: admin?.headers })
const signUp = await post('/api/auth/sign-up/email', {
	name: 'Switch Signup',
	email: `switch-${crypto.randomUUID()}@example.com`,
	password: 'password123',
})
const passwordReset = await post('/api/auth/request-password-reset', {
	email: 'nobody@example.com',
	redirectTo: 'http://localhost:3000/reset',
})

const spec = (await (await app.handle(new Request('http://localhost/docs/json'))).json()) as {
	paths: Record<string, unknown>
}

const result = {
	authRoute: (await request('/api/auth/get-session', { headers: admin?.headers })).status,
	publicRoute: (await request('/api/categories')).status,
	signedInRoute: (
		await post(
			'/api/posts',
			{ title: 'Feature switch', content: 'Created by a feature switch test.', categoryId: category.id },
			admin?.headers,
		)
	).status,
	roleRoute: roleRoute.status,
	roleError: roleRoute.code,
	permissionRoute: (
		await post(
			'/api/categories',
			{ name: `Switch ${crypto.randomUUID().slice(0, 8)}`, slug: `switch-${crypto.randomUUID().slice(0, 8)}` },
			admin?.headers,
		)
	).status,
	moderation: memberPost
		? (await request(`/api/posts/${memberPost.id}`, { method: 'DELETE', headers: admin?.headers })).status
		: null,
	signUp: signUp.status,
	passwordReset: passwordReset.status,
	docsSignUp: '/api/auth/sign-up/email' in spec.paths,
	docsPasswordReset: '/api/auth/request-password-reset' in spec.paths,
	// Admin plugin paths: 200 when roles are on, our 404 envelope when the plugin is not loaded.
	authAdminRoute: (await request('/api/auth/admin/list-users', { headers: admin?.headers })).status,
	docsAuthAdmin: '/api/auth/admin/list-users' in spec.paths,
}

console.log(JSON.stringify(result))
process.exit(0)

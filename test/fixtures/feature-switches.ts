/**
 * Runs in a child process so feature switches can be changed through the
 * environment (they are read once at startup). Prints one JSON line.
 */
import { app } from '#app'
import { categoryFactory, postFactory } from '#db/factories/index'
import { actingAs } from '../helpers'

const status = async (path: string, init?: RequestInit) =>
	(await app.handle(new Request(`http://localhost${path}`, init))).status

const authEnabled = process.env.AUTH_ENABLED !== 'false'
const admin = authEnabled ? await actingAs('admin') : null
const member = authEnabled ? await actingAs('member') : null
const category = await categoryFactory.create()
const memberPost = member ? await postFactory.create({ authorId: member.user.id, categoryId: category.id }) : null

const result = {
	authRoute: await status('/api/auth/get-session', { headers: admin?.headers }),
	publicRoute: await status('/api/categories'),
	signedInRoute: await status('/api/posts', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...admin?.headers },
		body: JSON.stringify({
			title: 'Feature switch',
			content: 'Created by a feature switch test.',
			categoryId: category.id,
		}),
	}),
	roleRoute: await status('/api/admin/stats', { headers: admin?.headers }),
	permissionRoute: await status('/api/categories', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...admin?.headers },
		body: JSON.stringify({
			name: `Switch ${crypto.randomUUID().slice(0, 8)}`,
			slug: `switch-${crypto.randomUUID().slice(0, 8)}`,
		}),
	}),
	moderation: memberPost
		? await status(`/api/posts/${memberPost.id}`, { method: 'DELETE', headers: admin?.headers })
		: null,
}

console.log(JSON.stringify(result))
process.exit(0)

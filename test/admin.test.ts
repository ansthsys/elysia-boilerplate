import { describe, expect, it } from 'bun:test'
import { actingAs, api } from './helpers'

describe('GET /api/admin/stats (role macro)', () => {
	it('is limited to admins', async () => {
		const member = await actingAs('member')
		expect((await api.api.admin.stats.get({ headers: member.headers })).status).toBe(403)

		const admin = await actingAs('admin')
		const { data, status } = await api.api.admin.stats.get({ headers: admin.headers })
		expect(status).toBe(200)
		expect(data?.data.users).toBeGreaterThan(0)
	})
})

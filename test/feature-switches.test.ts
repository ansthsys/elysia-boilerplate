import { describe, expect, it } from 'bun:test'

/** Starts the fixture with the given switches and returns the HTTP statuses it observed. */
async function probe(switches: Record<string, string>) {
	const child = Bun.spawn(['bun', 'run', `${import.meta.dir}/fixtures/feature-switches.ts`], {
		env: { ...process.env, ...switches },
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])
	if (code !== 0) throw new Error(`fixture failed (${code}):\n${stderr}`)
	return JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}')
}

describe('feature switches', () => {
	it('everything on: admin passes every guard', async () => {
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_ROLES_ENABLED: 'true' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 200,
			permissionRoute: 201,
			moderation: 200,
		})
	})

	it('AUTH_ROLES_ENABLED=false: sign-in still works, role and permission guards fail closed', async () => {
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_ROLES_ENABLED: 'false' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 403,
			permissionRoute: 403,
			moderation: 403, // admins can no longer delete other users' posts
		})
	})

	it('AUTH_ENABLED=false: auth routes are gone, guarded routes reject, public routes work', async () => {
		expect(await probe({ AUTH_ENABLED: 'false' })).toEqual({
			authRoute: 404,
			publicRoute: 200,
			signedInRoute: 401,
			roleRoute: 401,
			permissionRoute: 401,
			moderation: null,
		})
	})
})

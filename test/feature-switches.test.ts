import { describe, expect, it } from 'bun:test'

/** Starts the fixture with the given switches and returns what it observed. */
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
	it('everything on: admin passes every guard and the raw capabilities are exposed', async () => {
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_ROLES_ENABLED: 'true' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 200,
			roleError: null,
			permissionRoute: 201,
			moderation: 200,
			signUp: 200,
			passwordReset: 200,
			docsSignUp: true,
			docsPasswordReset: true,
			authAdminRoute: 200,
			docsAuthAdmin: true,
		})
	})

	it('AUTH_ROLES_ENABLED=false: sign-in still works, role and permission guards fail closed', async () => {
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_ROLES_ENABLED: 'false' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 403,
			roleError: 'FEATURE_DISABLED', // distinguishable from a plain FORBIDDEN
			permissionRoute: 403,
			moderation: 403, // admins can no longer delete other users' posts
			signUp: 200,
			passwordReset: 200,
			docsSignUp: true,
			docsPasswordReset: true,
			// The plugin is not loaded, so the registry also hides its paths.
			authAdminRoute: 404,
			docsAuthAdmin: false,
		})
	})

	it('AUTH_ENABLED=false: auth routes are gone, guarded routes reject, public routes work', async () => {
		expect(await probe({ AUTH_ENABLED: 'false' })).toEqual({
			authRoute: 404,
			publicRoute: 200,
			signedInRoute: 401,
			roleRoute: 401,
			roleError: 'UNAUTHORIZED',
			permissionRoute: 401,
			moderation: null,
			signUp: 404,
			passwordReset: 404,
			docsSignUp: false,
			docsPasswordReset: false,
			authAdminRoute: 404,
			docsAuthAdmin: false,
		})
	})

	it('AUTH_SIGN_UP_ENABLED=false: the endpoint is hidden, sign-in and seeders keep working', async () => {
		// `actingAs` (the fixture's own user creation) goes through auth.api.signUpEmail,
		// so a working fixture proves the capability is still there.
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_SIGN_UP_ENABLED: 'false' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 200,
			roleError: null,
			permissionRoute: 201,
			moderation: 200,
			signUp: 404,
			passwordReset: 200,
			docsSignUp: false,
			docsPasswordReset: true,
			authAdminRoute: 200,
			docsAuthAdmin: true,
		})
	})

	it('AUTH_PASSWORD_RESET_ENABLED=false: reset endpoints are hidden', async () => {
		expect(await probe({ AUTH_ENABLED: 'true', AUTH_PASSWORD_RESET_ENABLED: 'false' })).toEqual({
			authRoute: 200,
			publicRoute: 200,
			signedInRoute: 201,
			roleRoute: 200,
			roleError: null,
			permissionRoute: 201,
			moderation: 200,
			signUp: 200,
			passwordReset: 404,
			docsSignUp: true,
			docsPasswordReset: false,
			authAdminRoute: 200,
			docsAuthAdmin: true,
		})
	})
})

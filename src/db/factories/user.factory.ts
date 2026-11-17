import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { auth } from '#lib/auth'
import type { Role } from '#shared'
import { db } from '../client'
import { users } from '../schema'

export const DEFAULT_PASSWORD = 'password123'

interface UserOverrides {
	name?: string
	email?: string
	password?: string
	role?: Role
}

/**
 * Users are created through Better Auth (not a raw insert) so the password is
 * hashed and an `accounts` row exists - seeded users can actually sign in.
 */
export const userFactory = {
	make: (overrides: UserOverrides = {}) => ({
		name: faker.person.fullName(),
		email: faker.internet.email({ provider: 'example.test' }).toLowerCase(),
		password: DEFAULT_PASSWORD,
		role: 'member' as Role,
		...overrides,
	}),

	async create(overrides: UserOverrides = {}) {
		const data = userFactory.make(overrides)
		const { user } = await auth.api.signUpEmail({
			body: { name: data.name, email: data.email, password: data.password },
		})
		await db.update(users).set({ role: data.role, emailVerified: true }).where(eq(users.id, user.id))
		return { ...user, role: data.role, emailVerified: true, password: data.password }
	},
}

import { eq } from 'drizzle-orm'
import type { Role } from '#shared'
import { db } from '../client'
import { DEFAULT_PASSWORD, userFactory } from '../factories'
import { users } from '../schema'
import type { Seeder } from './seeder'

/** Fixed accounts for local development. Password for all: `password123`. */
export const SEED_USERS: { name: string; email: string; role: Role }[] = [
	{ name: 'Admin', email: 'admin@example.com', role: 'admin' },
	{ name: 'Member One', email: 'member1@example.com', role: 'member' },
	{ name: 'Member Two', email: 'member2@example.com', role: 'member' },
]

export const usersSeeder: Seeder = {
	name: 'users',
	async run() {
		let created = 0
		for (const account of SEED_USERS) {
			const exists = await db.query.users.findFirst({ where: eq(users.email, account.email), columns: { id: true } })
			if (exists) continue
			await userFactory.create({ ...account, password: DEFAULT_PASSWORD })
			created++
		}
		return `${created} created, ${SEED_USERS.length - created} already existed`
	},
}

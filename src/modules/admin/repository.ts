import { sql } from 'drizzle-orm'
import { db } from '#db/client'
import { categories, posts, users } from '#db/schema/index'

export abstract class AdminRepository {
	static async counts() {
		const [totalUsers, totalPosts, totalCategories] = await Promise.all([
			db.$count(users),
			db.$count(posts),
			db.$count(categories),
		])
		return { users: totalUsers, posts: totalPosts, categories: totalCategories }
	}

	/**
	 * Emails of users whose role list contains `admin`. The LIKE narrows in the
	 * database; the split filters exact tokens, so "notadmin" never matches.
	 */
	static async adminEmails(): Promise<string[]> {
		const rows = await db
			.select({ email: users.email, role: users.role })
			.from(users)
			.where(sql`lower(${users.role}) like ${'%admin%'}`)

		return rows.filter((row) => row.role?.split(',').some((role) => role.trim() === 'admin')).map((row) => row.email)
	}
}

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
}

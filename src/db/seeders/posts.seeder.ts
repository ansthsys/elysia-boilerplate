import { db } from '../client'
import { postFactory } from '../factories'
import { posts } from '../schema'
import type { Seeder } from './seeder'

const POSTS_PER_USER = 5

/** Depends on users and categories: run those seeders first. */
export const postsSeeder: Seeder = {
	name: 'posts',
	async run() {
		if ((await db.$count(posts)) > 0) return 'skipped (posts already exist)'

		const [authors, categoryRows] = await Promise.all([
			db.query.users.findMany({ columns: { id: true } }),
			db.query.categories.findMany({ columns: { id: true } }),
		])
		if (!authors.length || !categoryRows.length) {
			throw new Error('posts seeder needs users and categories - run `bun db:seed users categories` first')
		}

		let created = 0
		for (const author of authors) {
			for (let i = 0; i < POSTS_PER_USER; i++) {
				const category = categoryRows[(created + i) % categoryRows.length]
				if (category) await postFactory.create({ authorId: author.id, categoryId: category.id })
			}
			created += POSTS_PER_USER
		}
		return `${created} created`
	},
}

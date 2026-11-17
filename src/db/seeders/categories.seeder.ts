import { eq } from 'drizzle-orm'
import { db } from '../client'
import { categoryFactory } from '../factories'
import { categories } from '../schema'
import type { Seeder } from './seeder'

const SEED_CATEGORIES = [
	{ name: 'Engineering', slug: 'engineering', description: 'Code, architecture and tooling' },
	{ name: 'Product', slug: 'product', description: 'Roadmaps and product thinking' },
	{ name: 'Design', slug: 'design', description: 'UI, UX and visual design' },
]

export const categoriesSeeder: Seeder = {
	name: 'categories',
	async run() {
		let created = 0
		for (const category of SEED_CATEGORIES) {
			const exists = await db.query.categories.findFirst({ where: eq(categories.slug, category.slug) })
			if (exists) continue
			await categoryFactory.create(category)
			created++
		}
		return `${created} created`
	},
}

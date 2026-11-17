import { asc, count, eq, or } from 'drizzle-orm'
import { db } from '#db/client'
import { guardUnique } from '#db/errors'
import { newId } from '#db/id'
import { type Category, categories, type NewCategory, posts } from '#db/schema/index'

/**
 * Data access for categories: every Drizzle query of the module lives here.
 * Returns rows or `undefined` and never decides what "not found" means -
 * that is a business decision taken by the service.
 */
export abstract class CategoryRepository {
	static findAll(): Promise<Category[]> {
		return db.query.categories.findMany({ orderBy: [asc(categories.name)] })
	}

	static findById(id: string): Promise<Category | undefined> {
		return db.query.categories.findFirst({ where: eq(categories.id, id) })
	}

	static async exists(id: string): Promise<boolean> {
		const row = await db.query.categories.findFirst({ where: eq(categories.id, id), columns: { id: true } })
		return row !== undefined
	}

	/** Categories whose name or slug matches any of the given values. */
	static findByNameOrSlug({ name, slug }: { name?: string; slug?: string }) {
		const conditions = [name ? eq(categories.name, name) : undefined, slug ? eq(categories.slug, slug) : undefined]
		if (!name && !slug) return Promise.resolve([])
		return db
			.select({ id: categories.id, name: categories.name, slug: categories.slug })
			.from(categories)
			.where(or(...conditions))
	}

	static async countPosts(id: string): Promise<number> {
		const [row] = await db.select({ total: count() }).from(posts).where(eq(posts.categoryId, id))
		return row?.total ?? 0
	}

	/** @throws UniqueConstraintError when name or slug is taken. */
	static async create(values: Omit<NewCategory, 'id'>): Promise<string> {
		const id = newId()
		await guardUnique(() => db.insert(categories).values({ ...values, id }))
		return id
	}

	/** @throws UniqueConstraintError when name or slug is taken. */
	static async update(id: string, values: Partial<Omit<NewCategory, 'id'>>): Promise<void> {
		await guardUnique(() => db.update(categories).set(values).where(eq(categories.id, id)))
	}

	static async delete(id: string): Promise<void> {
		await db.delete(categories).where(eq(categories.id, id))
	}
}

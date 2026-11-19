import { and, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm'
import { db } from '#db/client'
import { newId } from '#db/id'
import { type NewPost, posts } from '#db/schema/index'

export interface PostFilters {
	categoryId?: string
	authorId?: string
	search?: string
	/** ISO date-times, already validated by the query schema. */
	createdAfter?: string
	createdBefore?: string
}

/** Relations returned with every post. */
const withRelations = {
	author: { columns: { id: true, name: true } },
	category: { columns: { id: true, name: true, slug: true } },
} as const

/**
 * Escapes LIKE wildcards so a search for "50%" matches literally.
 * `!` is the escape character because `\` needs different quoting in MySQL.
 */
const likePattern = (value: string) => `%${value.toLowerCase().replace(/[!%_]/g, '!$&')}%`

function toWhere(filters: PostFilters): SQL | undefined {
	const conditions: SQL[] = []
	if (filters.categoryId) conditions.push(eq(posts.categoryId, filters.categoryId))
	if (filters.authorId) conditions.push(eq(posts.authorId, filters.authorId))
	// lower() + LIKE behaves the same on PostgreSQL, MySQL and SQLite.
	if (filters.search) conditions.push(sql`lower(${posts.title}) like ${likePattern(filters.search)} escape '!'`)
	if (filters.createdAfter) conditions.push(gte(posts.createdAt, new Date(filters.createdAfter)))
	if (filters.createdBefore) conditions.push(lte(posts.createdAt, new Date(filters.createdBefore)))
	return conditions.length ? and(...conditions) : undefined
}

/** Data access for posts: every Drizzle query of the module lives here. */
export abstract class PostRepository {
	static findMany(filters: PostFilters, page: { limit: number; offset: number }) {
		return db.query.posts.findMany({
			where: toWhere(filters),
			with: withRelations,
			orderBy: [desc(posts.createdAt), desc(posts.id)],
			limit: page.limit,
			offset: page.offset,
		})
	}

	static count(filters: PostFilters): Promise<number> {
		return db.$count(posts, toWhere(filters))
	}

	static findById(id: string) {
		return db.query.posts.findFirst({ where: eq(posts.id, id), with: withRelations })
	}

	static async create(values: Omit<NewPost, 'id'>): Promise<string> {
		const id = newId()
		await db.insert(posts).values({ ...values, id })
		return id
	}

	static async update(id: string, values: Partial<Omit<NewPost, 'id' | 'authorId'>>): Promise<void> {
		await db.update(posts).set(values).where(eq(posts.id, id))
	}

	static async delete(id: string): Promise<void> {
		await db.delete(posts).where(eq(posts.id, id))
	}
}

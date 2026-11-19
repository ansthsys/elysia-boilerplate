import { describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { app } from '#app'
import { db } from '#db/client'
import { postFactory } from '#db/factories/index'
import { mailOutbox } from '#db/schema/index'
import { actingAs, api, createCategory } from './helpers'

const validPost = (categoryId: string) => ({
	title: 'Type-safe APIs with Elysia',
	content: 'Eden infers request and response types straight from the routes.',
	categoryId,
})

describe('GET /api/posts (pagination)', () => {
	it('returns page metadata with nextPage', async () => {
		const { user } = await actingAs()
		const category = await createCategory()
		await postFactory.createMany(5, { authorId: user.id, categoryId: category.id })

		const first = await api.api.posts.get({ query: { categoryId: category.id, limit: 2 } })
		expect(first.status).toBe(200)
		expect(first.data?.data).toHaveLength(2)
		expect(first.data?.meta).toEqual({
			page: 1,
			limit: 2,
			total: 5,
			totalPages: 3,
			hasNextPage: true,
			hasPrevPage: false,
			nextPage: 2,
			prevPage: null,
		})

		const last = await api.api.posts.get({ query: { categoryId: category.id, limit: 2, page: 3 } })
		expect(last.data?.data).toHaveLength(1)
		expect(last.data?.meta.nextPage).toBeNull()
	})

	it('includes author and category, with dates parsed by Eden', async () => {
		const { user } = await actingAs()
		const category = await createCategory()
		await postFactory.create({ authorId: user.id, categoryId: category.id })

		const { data } = await api.api.posts.get({ query: { categoryId: category.id } })
		const post = data?.data[0]

		expect(post?.author).toEqual({ id: user.id, name: user.name })
		expect(post?.category.slug).toBe(category.slug)
		expect(post?.createdAt).toBeInstanceOf(Date)
	})

	it('rejects non-numeric pagination params with the field name', async () => {
		// Casting on purpose: sending what a typed client never would.
		const { status, error } = await api.api.posts.get({ query: { page: 'abc' as unknown as number } })

		expect(status).toBe(422)
		expect(error?.value.error.details).toEqual([
			{ field: 'page', message: 'page must be an integer', location: 'query' },
		])
	})

	it('filters by creation date and rejects an invalid date-time', async () => {
		const { user } = await actingAs()
		const category = await createCategory()
		await postFactory.create({ authorId: user.id, categoryId: category.id })

		const beforeEpoch = await api.api.posts.get({
			query: { categoryId: category.id, createdBefore: '2000-01-01T00:00:00Z' },
		})
		expect(beforeEpoch.data?.data).toHaveLength(0)

		const wideRange = await api.api.posts.get({
			query: {
				categoryId: category.id,
				createdAfter: '2000-01-01T00:00:00Z',
				createdBefore: '2999-01-01T00:00:00Z',
			},
		})
		expect(wideRange.data?.data.length).toBeGreaterThan(0)

		const invalid = await api.api.posts.get({
			query: { createdAfter: 'not-a-date' as unknown as string },
		})
		expect(invalid.status).toBe(422)
		expect(invalid.error?.value.error.details?.[0]?.field).toBe('createdAfter')
	})
})

describe('POST /api/posts', () => {
	it('creates a post for the signed-in member (201)', async () => {
		const { user, headers } = await actingAs('member')
		const category = await createCategory()

		const { data, status } = await api.api.posts.post(validPost(category.id), { headers })

		expect(status).toBe(201)
		expect(data?.data.author.id).toBe(user.id)
		expect(data?.data.category.id).toBe(category.id)
	})

	it('returns 422 on categoryId when the category does not exist (business rule)', async () => {
		const { headers } = await actingAs()

		const { status, error } = await api.api.posts.post(validPost('01900000-0000-7000-8000-000000000000'), { headers })

		expect(status).toBe(422)
		expect(error?.value.error.details).toEqual([
			{ field: 'categoryId', message: 'Category does not exist', location: 'body' },
		])
	})

	it('returns every invalid field at once (422)', async () => {
		const { headers } = await actingAs()

		const { status, error } = await api.api.posts.post(
			{ title: 'Hi', content: 'short', categoryId: 'nope' },
			{ headers },
		)

		expect(status).toBe(422)
		expect(error?.value.error.details?.map((detail) => detail.field)).toEqual(['title', 'content', 'categoryId'])
	})

	it('accepts a date-only column and rejects an invalid date (422)', async () => {
		const { headers } = await actingAs()
		const category = await createCategory()

		const created = await api.api.posts.post({ ...validPost(category.id), publishedOn: '2026-01-31' }, { headers })
		expect(created.status).toBe(201)
		// Assert the wire value: a date-only column must not become a timestamp.
		const id = created.data?.data.id as string
		const raw = await app.handle(new Request(`http://localhost/api/posts/${id}`))
		const body = (await raw.json()) as { data: { publishedOn: unknown } }
		expect(body.data.publishedOn).toBe('2026-01-31')

		const invalid = await api.api.posts.post({ ...validPost(category.id), publishedOn: '31/01/2026' }, { headers })
		expect(invalid.status).toBe(422)
		expect(invalid.error?.value.error.details?.[0]?.field).toBe('publishedOn')
	})

	it('queues a review email to admins when a member creates an unpublished post', async () => {
		const admin = await actingAs('admin')
		const member = await actingAs('member')
		const category = await createCategory()

		const created = await api.api.posts.post(validPost(category.id), { headers: member.headers })
		expect(created.status).toBe(201)

		const title = created.data?.data.title as string
		const queued = await db
			.select({ to: mailOutbox.to, subject: mailOutbox.subject })
			.from(mailOutbox)
			.where(eq(mailOutbox.to, admin.user.email))

		expect(queued.some((mail) => mail.subject.includes(title))).toBe(true)
	})
})

describe('PATCH/DELETE /api/posts/:id (ownership)', () => {
	async function postOwnedByMember() {
		const owner = await actingAs('member')
		const category = await createCategory()
		const post = await postFactory.create({ authorId: owner.user.id, categoryId: category.id })
		return { owner, post }
	}

	it('returns 404 for an unknown post before checking ownership', async () => {
		const { headers } = await actingAs()
		const { status } = await api.api
			.posts({ id: '01900000-0000-7000-8000-000000000000' })
			.patch({ title: 'Updated title' }, { headers })

		expect(status).toBe(404)
	})

	it('lets the owner update, forbids other members (403)', async () => {
		const { owner, post } = await postOwnedByMember()
		const stranger = await actingAs('member')

		const forbidden = await api.api
			.posts({ id: post.id })
			.patch({ title: 'Hijacked title' }, { headers: stranger.headers })
		expect(forbidden.status).toBe(403)
		expect(forbidden.error?.value.error.message).toBe('You can only update your own posts')

		const updated = await api.api.posts({ id: post.id }).patch({ title: 'Updated title' }, { headers: owner.headers })
		expect(updated.status).toBe(200)
		expect(updated.data?.data.title).toBe('Updated title')
	})

	it('lets an admin delete any post (post:delete permission)', async () => {
		const { post } = await postOwnedByMember()
		const admin = await actingAs('admin')

		const { status } = await api.api.posts({ id: post.id }).delete(undefined, { headers: admin.headers })
		expect(status).toBe(200)

		const after = await api.api.posts({ id: post.id }).get()
		expect(after.status).toBe(404)
	})
})

import { describe, expect, it } from 'bun:test'
import { faker } from '@faker-js/faker'
import { postFactory } from '#db/factories/index'
import { actingAs, api, createCategory } from './helpers'

const newCategory = () => {
	const name = `Cat ${faker.string.alphanumeric(8)}`
	return { name, slug: faker.helpers.slugify(name).toLowerCase() }
}

describe('categories', () => {
	it('lists every category without pagination', async () => {
		const created = await createCategory()
		const { data, status } = await api.api.categories.get()

		expect(status).toBe(200)
		expect(data?.data.map((category) => category.id)).toContain(created.id)
		expect(data).not.toHaveProperty('meta')
	})

	it('lets an admin create a category (201)', async () => {
		const { headers } = await actingAs('admin')
		const body = newCategory()

		const { data, status } = await api.api.categories.post(body, { headers })

		expect(status).toBe(201)
		expect(data?.data).toMatchObject({ ...body, description: null })
	})

	it('rejects anonymous users (401) and members (403)', async () => {
		const anonymous = await api.api.categories.post(newCategory())
		expect(anonymous.status).toBe(401)
		expect(anonymous.error?.value.error.code).toBe('UNAUTHORIZED')

		const { headers } = await actingAs('member')
		const member = await api.api.categories.post(newCategory(), { headers })
		expect(member.status).toBe(403)
		expect(member.error?.value.error.code).toBe('FORBIDDEN')
	})

	it('returns field-level validation errors (422)', async () => {
		const { headers } = await actingAs('admin')

		const { error, status } = await api.api.categories.post({ name: 'X', slug: 'Not A Slug' }, { headers })

		expect(status).toBe(422)
		expect(error?.value.error.details).toEqual([
			{ field: 'name', message: 'Name must be between 2 and 100 characters', location: 'body' },
			{ field: 'slug', message: expect.stringContaining('lowercase letters'), location: 'body' },
		])
	})

	it('reports duplicates per field (409)', async () => {
		const { headers } = await actingAs('admin')
		const existing = await createCategory()

		const { error, status } = await api.api.categories.post({ name: existing.name, slug: existing.slug }, { headers })

		expect(status).toBe(409)
		expect(error?.value.error.details?.map((detail) => detail.field)).toEqual(['name', 'slug'])
	})

	it('refuses to delete a category that still has posts (409)', async () => {
		const { user, headers } = await actingAs('admin')
		const category = await createCategory()
		await postFactory.create({ authorId: user.id, categoryId: category.id })

		const { status, error } = await api.api.categories({ id: category.id }).delete(undefined, { headers })

		expect(status).toBe(409)
		expect(error?.value.error.message).toContain('used by 1 post')
	})
})

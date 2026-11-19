import { describe, expect, it } from 'bun:test'
import { postFactory } from '#db/factories/index'
import { PostModel } from '#modules/posts/model'
import { actingAs, api, createCategory } from './helpers'

/**
 * Response ↔ model contract. A composed schema (row + relations) cannot be
 * derived from the table, and the repository projection is written by hand,
 * so the two can drift silently. This test fails as soon as they do.
 */
const keysOf = (schema: { properties: Record<string, unknown> }) => Object.keys(schema.properties).sort()

describe('response contract', () => {
	it('post payload keys match the published model, including relation subsets', async () => {
		const { user } = await actingAs()
		const category = await createCategory()
		await postFactory.create({ authorId: user.id, categoryId: category.id })

		const { data } = await api.api.posts.get({ query: { categoryId: category.id } })
		const post = data?.data[0] as Record<string, unknown> | undefined
		expect(post).toBeDefined()

		const model = PostModel.post
		expect(Object.keys(post as object).sort()).toEqual(keysOf(model))

		const author = model.properties.author as { properties: Record<string, unknown> }
		expect(Object.keys(post?.author as object).sort()).toEqual(Object.keys(author.properties).sort())

		const relation = model.properties.category as { properties: Record<string, unknown> }
		expect(Object.keys(post?.category as object).sort()).toEqual(Object.keys(relation.properties).sort())
	})
})

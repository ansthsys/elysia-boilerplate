import { Elysia } from 'elysia'
import { errorResponses, ok } from '#core/http'
import { authGuard } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { CategoryModel } from './model'
import { CategoryService } from './service'

/**
 * Categories - example of a small, bounded resource:
 * - list without pagination
 * - writes protected by the `permission` macro (admins only)
 */
export const categoriesModule = new Elysia({ prefix: '/api/categories', detail: { tags: ['Categories'] } })
	.use(errorHandler)
	.use(authGuard)
	.get('', async () => ok(await CategoryService.list()), {
		response: { 200: CategoryModel.listResponse, ...errorResponses() },
		detail: {
			summary: 'List categories',
			description: 'Returns every category, sorted by name. Not paginated: the set is small and bounded.',
		},
	})
	.get('/:id', async ({ params }) => ok(await CategoryService.findById(params.id)), {
		params: CategoryModel.params,
		response: { 200: CategoryModel.categoryResponse, ...errorResponses(404, 422) },
		detail: { summary: 'Get a category' },
	})
	.post('', async ({ body, status }) => status(201, ok(await CategoryService.create(body))), {
		permission: { category: ['create'] },
		body: CategoryModel.create,
		response: { 201: CategoryModel.categoryResponse, ...errorResponses(401, 403, 409, 422) },
		detail: { summary: 'Create a category', description: 'Requires the `category:create` permission (admin).' },
	})
	.patch('/:id', async ({ params, body }) => ok(await CategoryService.update(params.id, body)), {
		permission: { category: ['update'] },
		params: CategoryModel.params,
		body: CategoryModel.update,
		response: { 200: CategoryModel.categoryResponse, ...errorResponses(401, 403, 404, 409, 422) },
		detail: { summary: 'Update a category', description: 'Requires the `category:update` permission (admin).' },
	})
	.delete(
		'/:id',
		async ({ params }) => {
			await CategoryService.remove(params.id)
			return ok(null)
		},
		{
			permission: { category: ['delete'] },
			params: CategoryModel.params,
			response: { 200: CategoryModel.deleteResponse, ...errorResponses(401, 403, 404, 409, 422) },
			detail: {
				summary: 'Delete a category',
				description: 'Fails with 409 while posts still use the category. Requires `category:delete` (admin).',
			},
		},
	)

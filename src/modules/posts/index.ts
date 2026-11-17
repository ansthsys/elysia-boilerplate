import { Elysia } from 'elysia'
import { errorResponses, ok, paginated } from '#core/http'
import { authGuard } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { PostModel } from './model'
import { PostService } from './service'

/**
 * Posts - example of an unbounded resource:
 * - paginated + filtered list (`?page=2&limit=10&search=elysia`)
 * - create: any signed-in user (`auth` macro)
 * - update/delete: the author, or a user with `post:update` / `post:delete` (admin)
 * - `guard` shares the `:id` params schema between the routes that need it
 */
export const postsModule = new Elysia({ prefix: '/api/posts', detail: { tags: ['Posts'] } })
	.use(errorHandler)
	.use(authGuard)
	.get(
		'',
		async ({ query }) => {
			const { items, meta } = await PostService.list(query)
			return paginated(items, meta)
		},
		{
			query: PostModel.listQuery,
			response: { 200: PostModel.listResponse, ...errorResponses(422) },
			detail: {
				summary: 'List posts',
				description:
					'Offset pagination. `meta.nextPage` is `null` on the last page, so clients can loop ' +
					'`while (meta.nextPage)` without computing pages themselves.',
			},
		},
	)
	.post('', async ({ body, user, status }) => status(201, ok(await PostService.create(body, user))), {
		auth: true,
		body: PostModel.create,
		response: { 201: PostModel.postResponse, ...errorResponses(401, 422) },
		detail: { summary: 'Create a post', description: 'The author is the signed-in user.' },
	})
	.guard({ params: PostModel.params }, (app) =>
		app
			.get('/:id', async ({ params }) => ok(await PostService.findById(params.id)), {
				response: { 200: PostModel.postResponse, ...errorResponses(404, 422) },
				detail: { summary: 'Get a post' },
			})
			.patch('/:id', async ({ params, body, user }) => ok(await PostService.update(params.id, body, user)), {
				auth: true,
				body: PostModel.update,
				response: { 200: PostModel.postResponse, ...errorResponses(401, 403, 404, 422) },
				detail: { summary: 'Update a post', description: 'Allowed for the author, or with `post:update` (admin).' },
			})
			.delete(
				'/:id',
				async ({ params, user }) => {
					await PostService.remove(params.id, user)
					return ok(null)
				},
				{
					auth: true,
					response: { 200: PostModel.deleteResponse, ...errorResponses(401, 403, 404, 422) },
					detail: { summary: 'Delete a post', description: 'Allowed for the author, or with `post:delete` (admin).' },
				},
			),
	)

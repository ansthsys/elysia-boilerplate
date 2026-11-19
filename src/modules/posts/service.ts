import { type Actor, can } from '#core/access'
import { ForbiddenError, NotFoundError } from '#core/errors'
import { postPendingReviewEmail } from '#emails/post-pending-review'
import { AdminService } from '#modules/admin/service'
import { CategoryService } from '#modules/categories/service'
import { MailService } from '#modules/mail/service'
import { buildPaginationMeta, resolvePagination } from '#shared'
import type { PostModel } from './model'
import { PostRepository } from './repository'

/**
 * Business rules for posts: existence (404), ownership (403), referenced
 * category (422) and pagination. Data access goes through PostRepository.
 */
export abstract class PostService {
	static async list(query: PostModel['listQuery']) {
		const { page, limit, offset } = resolvePagination(query)
		const filters = {
			categoryId: query.categoryId,
			authorId: query.authorId,
			search: query.search,
			createdAfter: query.createdAfter,
			createdBefore: query.createdBefore,
		}

		const [items, total] = await Promise.all([
			PostRepository.findMany(filters, { limit, offset }),
			PostRepository.count(filters),
		])
		return { items, meta: buildPaginationMeta(page, limit, total) }
	}

	static async findById(id: string) {
		const post = await PostRepository.findById(id)
		if (!post) throw new NotFoundError('Post')
		return post
	}

	static async create(input: PostModel['create'], author: Actor) {
		await CategoryService.assertExists(input.categoryId) // 422 on `categoryId`
		const id = await PostRepository.create({ ...input, authorId: author.id })
		const post = await PostService.findById(id)
		// An admin creating an already-published post needs no review request.
		if (!post.publishedOn) await PostService.requestReview(post)
		return post
	}

	/**
	 * Example of a feature email: every admin is queued a review request. The
	 * queue insert is fast; the drain worker does the actual send.
	 */
	private static async requestReview(post: Awaited<ReturnType<typeof PostService.findById>>) {
		const admins = await AdminService.adminEmails()
		if (admins.length === 0) return

		const mail = postPendingReviewEmail({
			postId: post.id,
			title: post.title,
			authorName: post.author.name,
			categoryName: post.category.name,
		})
		await Promise.all(admins.map((to) => MailService.queue({ to, ...mail })))
	}

	static async update(id: string, input: PostModel['update'], actor: Actor) {
		const post = await PostService.findById(id) // 404 first, then 403
		PostService.assertCanModify(post.authorId, actor, 'update')
		if (input.categoryId) await CategoryService.assertExists(input.categoryId)

		await PostRepository.update(id, input)
		return PostService.findById(id)
	}

	static async remove(id: string, actor: Actor) {
		const post = await PostService.findById(id)
		PostService.assertCanModify(post.authorId, actor, 'delete')
		await PostRepository.delete(id)
	}

	/** Authors manage their own posts; `post:update` / `post:delete` (admin) manage anyone's. */
	private static assertCanModify(authorId: string, actor: Actor, action: 'update' | 'delete') {
		if (authorId === actor.id || can(actor.role, { post: [action] })) return
		throw new ForbiddenError(`You can only ${action} your own posts`)
	}
}

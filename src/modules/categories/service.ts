import { ConflictError, NotFoundError, UnprocessableEntityError } from '#core/errors'
import { UniqueConstraintError } from '#db/errors'
import type { ErrorDetail } from '#shared'
import type { CategoryModel } from './model'
import { CategoryRepository } from './repository'

/**
 * Business rules for categories. Orchestrates the repository and decides
 * what is an error; knows nothing about HTTP or SQL.
 */
export abstract class CategoryService {
	static list() {
		return CategoryRepository.findAll()
	}

	static async findById(id: string) {
		const category = await CategoryRepository.findById(id)
		if (!category) throw new NotFoundError('Category')
		return category
	}

	/**
	 * For other services validating a foreign key from user input: an unknown
	 * id is the client's mistake (422 on that field), not a missing resource (404).
	 */
	static async assertExists(id: string, field = 'categoryId') {
		if (!(await CategoryRepository.exists(id))) {
			throw UnprocessableEntityError.field(field, 'Category does not exist')
		}
	}

	static async create(input: CategoryModel['create']) {
		await CategoryService.assertUnique(input)
		const id = await CategoryService.handleDuplicate(() => CategoryRepository.create(input))
		return CategoryService.findById(id)
	}

	static async update(id: string, input: CategoryModel['update']) {
		await CategoryService.findById(id) // 404 before anything else
		await CategoryService.assertUnique(input, id)
		await CategoryService.handleDuplicate(() => CategoryRepository.update(id, input))
		return CategoryService.findById(id)
	}

	static async remove(id: string) {
		await CategoryService.findById(id)
		const usage = await CategoryRepository.countPosts(id)
		if (usage > 0) throw new ConflictError(`Category is used by ${usage} post(s); move or delete them first`)
		await CategoryRepository.delete(id)
	}

	/** Field-level messages for duplicates, checked before writing. */
	private static async assertUnique(input: { name?: string; slug?: string }, exceptId?: string) {
		const others = (await CategoryRepository.findByNameOrSlug(input)).filter((row) => row.id !== exceptId)

		const details: ErrorDetail[] = []
		if (input.name && others.some((row) => row.name === input.name)) {
			details.push({ field: 'name', message: 'A category with this name already exists' })
		}
		if (input.slug && others.some((row) => row.slug === input.slug)) {
			details.push({ field: 'slug', message: 'A category with this slug already exists' })
		}
		if (details.length) throw new ConflictError('Category already exists', details)
	}

	/** The unique index is the real guarantee: two concurrent requests can both pass the pre-check. */
	private static async handleDuplicate<T>(write: () => Promise<T>): Promise<T> {
		try {
			return await write()
		} catch (error) {
			if (error instanceof UniqueConstraintError) throw new ConflictError('Category already exists')
			throw error
		}
	}
}

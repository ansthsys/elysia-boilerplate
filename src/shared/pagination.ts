import { type Static, type TSchema, Type as t } from '@sinclair/typebox'

/**
 * Offset pagination (page + limit).
 *
 * Use it for lists that can grow without bound (posts, users, orders...).
 * Small, bounded lists (categories, roles, countries) can return everything
 * without pagination - see `GET /api/categories`.
 *
 * The client never computes page math itself: `meta.nextPage` is `null` on
 * the last page, so "load more" is simply `if (meta.nextPage) fetch(nextPage)`.
 */
export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

export const PaginationMetaSchema = t.Object({
	page: t.Integer(),
	limit: t.Integer(),
	total: t.Integer({ description: 'Total items across all pages' }),
	totalPages: t.Integer(),
	hasNextPage: t.Boolean(),
	hasPrevPage: t.Boolean(),
	nextPage: t.Union([t.Integer(), t.Null()]),
	prevPage: t.Union([t.Integer(), t.Null()]),
})

export const paginatedSchema = <T extends TSchema>(item: T) =>
	t.Object({ success: t.Literal(true), data: t.Array(item), meta: PaginationMetaSchema })

/** Query params accepted by paginated endpoints (validated by the API, see apps/api/src/core/pagination.ts). */
export interface PaginationQuery {
	page?: number
	limit?: number
}
export type PaginationMeta = Static<typeof PaginationMetaSchema>
export type PaginatedResponse<T> = { success: true; data: T[]; meta: PaginationMeta }

/** Normalises raw query values into a safe `{ page, limit, offset }`. */
export function resolvePagination(query: PaginationQuery = {}) {
	const page = Math.max(1, query.page ?? 1)
	const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, query.limit ?? PAGINATION_DEFAULT_LIMIT))
	return { page, limit, offset: (page - 1) * limit }
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
	const totalPages = Math.max(1, Math.ceil(total / limit))
	const hasNextPage = page < totalPages
	const hasPrevPage = page > 1
	return {
		page,
		limit,
		total,
		totalPages,
		hasNextPage,
		hasPrevPage,
		nextPage: hasNextPage ? page + 1 : null,
		prevPage: hasPrevPage ? page - 1 : null,
	}
}

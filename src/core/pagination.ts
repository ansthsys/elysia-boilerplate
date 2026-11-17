import { t } from 'elysia'
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '#shared'

/**
 * `?page=&limit=` for paginated endpoints. Combine with filters:
 *
 *   query: t.Object({ ...PaginationQuery.properties, search: t.Optional(t.String()) })
 *
 * - Built with Elysia's `t` (not plain TypeBox): only Elysia's numeric types
 *   are coerced from query strings ("2" → 2).
 * - Out-of-range values are clamped by `resolvePagination` (page 0 → 1,
 *   limit 500 → 100) instead of rejected. Elysia 1.x reports a failed
 *   `minimum`/`maximum` on a coerced query number without the field name, so
 *   clamping gives clients a better experience. Non-numbers still fail with
 *   `{ field: 'page', ... }`.
 */
export const PaginationQuery = t.Object({
	page: t.Optional(
		t.Integer({ default: 1, description: 'Page number, starts at 1', error: 'page must be an integer' }),
	),
	limit: t.Optional(
		t.Integer({
			default: PAGINATION_DEFAULT_LIMIT,
			description: `Items per page, 1-${PAGINATION_MAX_LIMIT} (clamped)`,
			error: 'limit must be an integer',
		}),
	),
})

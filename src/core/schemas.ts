import { t } from 'elysia'

/**
 * Route params shared by resource endpoints.
 *
 * `label` only changes the validation message, so the 422 still names the
 * resource (`Invalid post id`) while the shape lives in one place.
 */
export const idParams = (label: string) => t.Object({ id: t.String({ format: 'uuid', error: `Invalid ${label} id` }) })

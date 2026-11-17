import { env } from '#config/env'
import { hasPermission, type Permissions } from '#shared'

/**
 * Permission check for services (business rules that depend on data, such
 * as "authors edit their own posts, moderators edit any post").
 * Always false when roles are switched off (AUTH_ROLES_ENABLED=false).
 */
export const can = (role: string | null | undefined, permissions: Permissions) =>
	env.AUTH_ROLES_ENABLED && hasPermission(role, permissions)

/** Who performs an action. Decoupled from Better Auth's session type. */
export interface Actor {
	id: string
	role?: string | null
}

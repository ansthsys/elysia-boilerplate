import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

/**
 * Role & permission definitions (Better Auth access control).
 *
 * Shared so the API enforces them and the frontend can use the same rules to
 * show/hide UI (`hasPermission(user.role, { post: ['update'] })`).
 *
 * To add a resource: add it to `statements`, then grant actions per role.
 */
export const statements = {
	...defaultStatements, // user / session management used by Better Auth's admin plugin
	/** Moderation: edit/delete posts of other users (authors always manage their own). */
	post: ['update', 'delete'],
	category: ['create', 'update', 'delete'],
} as const

export const ac = createAccessControl(statements)

export const roles = {
	/** Regular user. Creates posts and manages their own (ownership is checked in the service). */
	member: ac.newRole({
		...userAc.statements,
	}),
	/** Full access, including editing/deleting anyone's post and managing categories and users. */
	admin: ac.newRole({
		...adminAc.statements,
		post: ['update', 'delete'],
		category: ['create', 'update', 'delete'],
	}),
}

export type Role = keyof typeof roles
export const ROLES = Object.keys(roles) as Role[]
export const DEFAULT_ROLE: Role = 'member'

/** `{ post: ['update'] }` - any subset of `statements`. */
export type Permissions = {
	[K in keyof typeof statements]?: Array<(typeof statements)[K][number]>
}

const isRole = (value: string): value is Role => value in roles

/**
 * Better Auth stores multiple roles as a comma separated string ("admin,member").
 * Returns true when at least one of the user's roles grants every requested action.
 */
export function hasPermission(role: string | null | undefined, permissions: Permissions): boolean {
	if (!role) return false
	return role
		.split(',')
		.map((r) => r.trim())
		.filter(isRole)
		.some((r) => roles[r].authorize(permissions).success)
}

export function hasRole(role: string | null | undefined, allowed: Role | Role[]): boolean {
	if (!role) return false
	const wanted = Array.isArray(allowed) ? allowed : [allowed]
	return role.split(',').some((r) => wanted.includes(r.trim() as Role))
}

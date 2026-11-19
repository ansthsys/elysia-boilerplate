import type { BetterAuthPlugin } from 'better-auth'
import { admin, bearer, openAPI } from 'better-auth/plugins'
import { env } from '#config/env'
import { ac, DEFAULT_ROLE, roles } from '#shared'

/**
 * One entry per Better Auth capability. This is the only place to touch when
 * adding a plugin: the plugin array and the hidden-path list are derived from
 * here, so the runtime, `/docs` and the 404 filter cannot disagree.
 *
 *   enabled: false + plugin  → the plugin is not loaded; its routes do not exist
 *   enabled: false + paths   → routes are hidden, but the server-side capability
 *                              stays (seeders, factories, tests keep working)
 *   enabled: true            → nothing to do
 *
 * Why not pre-register every Better Auth plugin as disabled? `enabled` is a
 * runtime value, so `plugin: () => twoFactor()` still puts that code in the
 * bundle, adds its tables/migrations and widens the `auth.api` type. Add an
 * entry only for capabilities this project actually supports.
 */
interface AuthFeature {
	enabled: boolean
	/** Loaded into the Better Auth instance when `enabled`. */
	plugin?: () => BetterAuthPlugin
	/** Paths relative to `/api/auth`, hidden when the feature is off. */
	paths?: readonly string[]
}

export const authFeatures = {
	/** Provides `auth.api.generateOpenAPISchema()`, merged into /docs. It has no routes of its own. */
	openapi: { enabled: true, plugin: () => openAPI({ disableDefaultReference: true }) },

	admin: {
		enabled: env.AUTH_ROLES_ENABLED,
		plugin: () => admin({ ac, roles, defaultRole: DEFAULT_ROLE, adminRoles: ['admin'] }),
		paths: ['admin'],
	},

	/** `Authorization: Bearer <session token>` for mobile/API clients. */
	bearer: { enabled: env.AUTH_BEARER_ENABLED, plugin: () => bearer() },

	/**
	 * HTTP-level switch: `auth.api.signUpEmail` must keep working for
	 * `bun db:seed`, the factories and `actingAs()`. Better Auth's own
	 * `disableSignUp` would disable it everywhere.
	 */
	signUp: { enabled: env.AUTH_SIGN_UP_ENABLED, paths: ['sign-up'] },

	passwordReset: {
		enabled: env.AUTH_PASSWORD_RESET_ENABLED,
		paths: ['request-password-reset', 'reset-password'],
	},
} as const satisfies Record<string, AuthFeature>

type AuthFeatureEntry = (typeof authFeatures)[keyof typeof authFeatures]
type PluginFactory = Extract<AuthFeatureEntry, { plugin: () => unknown }>['plugin']
/**
 * Union of every plugin this app may load. Annotating the array with it keeps
 * `auth.api.*` typed for plugins that are switched off at runtime.
 */
type SupportedPlugin = ReturnType<PluginFactory>

const entries = Object.values(authFeatures) as AuthFeatureEntry[]

export const authPlugins: SupportedPlugin[] = entries.flatMap((feature) =>
	feature.enabled && 'plugin' in feature && feature.plugin ? [feature.plugin()] : [],
)

const disabledPrefixes = entries.flatMap((feature) =>
	!feature.enabled && 'paths' in feature ? [...feature.paths] : [],
)

/** Used by `authRoutes` and `plugins/openapi.ts`: a hidden endpoint must not appear in `/docs`. */
export function isAuthPathDisabled(pathname: string) {
	const relative = pathname.replace(/^\/api\/auth\/?/, '')
	return disabledPrefixes.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))
}

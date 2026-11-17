import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, bearer, openAPI } from 'better-auth/plugins'
import { corsOrigins, env, isProduction } from '#config/env'
import { db } from '#db/client'
import { dialect } from '#db/dialect'
import { newId } from '#db/id'
import { accounts, sessions, users, verifications } from '#db/schema/index'
import { sendMail } from '#lib/mailer'
import { ac, DEFAULT_ROLE, roles } from '#shared'

/**
 * Better Auth plugins, each behind its own switch.
 *
 * Add a plugin: import it, add an env switch in `config/env.ts`, append it
 * below, and add any columns it needs to `db/schema/auth.ts`.
 * The array is always typed with every plugin, so `auth.api.*` and the
 * session user type stay complete even when a plugin is switched off.
 */
const plugins = [
	// Exposes auth.api.generateOpenAPISchema() - merged into /docs.
	openAPI({ disableDefaultReference: true }),
	...(env.AUTH_ROLES_ENABLED ? [admin({ ac, roles, defaultRole: DEFAULT_ROLE, adminRoles: ['admin'] })] : []),
	// Accept `Authorization: Bearer <session token>` (mobile apps, API clients, /docs "Try it").
	...(env.AUTH_BEARER_ENABLED ? [bearer()] : []),
]

export const auth = betterAuth({
	appName: env.APP_NAME,
	baseURL: env.APP_URL,
	basePath: '/api/auth',
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: corsOrigins,

	database: drizzleAdapter(db, {
		provider: dialect.betterAuth,
		usePlural: true,
		schema: { users, sessions, accounts, verifications },
	}),

	user: {
		// Declared here (not only by the admin plugin) so `user.role` is typed
		// whether or not AUTH_ROLES_ENABLED is on. `input: false` stops clients
		// from choosing their own role at sign-up.
		additionalFields: {
			role: { type: 'string', required: false, input: false, defaultValue: DEFAULT_ROLE },
		},
	},

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
		sendResetPassword: async ({ user, url }) => {
			await sendMail({
				to: user.email,
				subject: 'Reset your password',
				text: `Reset your password: ${url}`,
				html: `<p>Reset your password: <a href="${url}">${url}</a></p>`,
			})
		},
	},

	emailVerification: {
		sendOnSignUp: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
		sendVerificationEmail: async ({ user, url }) => {
			await sendMail({
				to: user.email,
				subject: 'Verify your email address',
				text: `Verify your email: ${url}`,
				html: `<p>Verify your email: <a href="${url}">${url}</a></p>`,
			})
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // refresh expiry once per day
	},

	// Better Auth's own limiter protects sign-in/sign-up against brute force.
	rateLimit: { enabled: env.RATE_LIMIT_ENABLED, window: 60, max: 20 },

	advanced: {
		useSecureCookies: isProduction,
		database: { generateId: () => newId() },
	},

	plugins,
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthUser = AuthSession['user']

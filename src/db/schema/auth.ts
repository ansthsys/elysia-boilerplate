import { timestamps } from '../columns'
import { column, index, table } from '../dialect'

/**
 * Better Auth tables (users, sessions, accounts, verifications).
 *
 * Columns follow Better Auth's core schema plus the admin plugin fields
 * (role, banned, banReason, banExpires, impersonatedBy). They are kept even
 * when AUTH_ROLES_ENABLED=false so toggling the plugin never needs a migration.
 * After adding a Better Auth plugin that needs new columns, run
 * `bunx @better-auth/cli generate` to see the fields and add them here.
 */
export const users = table('users', {
	id: column.id(),
	name: column.string('name').notNull(),
	email: column.string('email').notNull().unique(),
	emailVerified: column.boolean('email_verified').notNull().default(false),
	image: column.text('image'),
	role: column.string('role', 100),
	banned: column.boolean('banned').default(false),
	banReason: column.text('ban_reason'),
	banExpires: column.timestamp('ban_expires'),
	...timestamps(),
})

export const sessions = table(
	'sessions',
	{
		id: column.id(),
		token: column.string('token').notNull().unique(),
		expiresAt: column.timestamp('expires_at').notNull(),
		ipAddress: column.text('ip_address'),
		userAgent: column.text('user_agent'),
		impersonatedBy: column.foreignId('impersonated_by'),
		userId: column
			.foreignId('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps(),
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)],
)

export const accounts = table(
	'accounts',
	{
		id: column.id(),
		accountId: column.string('account_id').notNull(),
		providerId: column.string('provider_id').notNull(),
		userId: column
			.foreignId('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: column.text('access_token'),
		refreshToken: column.text('refresh_token'),
		idToken: column.text('id_token'),
		accessTokenExpiresAt: column.timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: column.timestamp('refresh_token_expires_at'),
		scope: column.text('scope'),
		password: column.text('password'),
		...timestamps(),
	},
	(t) => [index('accounts_user_id_idx').on(t.userId)],
)

export const verifications = table(
	'verifications',
	{
		id: column.id(),
		identifier: column.string('identifier').notNull(),
		value: column.text('value').notNull(),
		expiresAt: column.timestamp('expires_at').notNull(),
		...timestamps(),
	},
	(t) => [index('verifications_identifier_idx').on(t.identifier)],
)

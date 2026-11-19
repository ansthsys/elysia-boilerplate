import { relations } from 'drizzle-orm'
import { accounts, sessions, users } from './auth'
import { categories } from './categories'
import { files } from './files'
import { posts } from './posts'

/**
 * Relations power `db.query.<table>.findMany({ with: { ... } })`.
 * Kept in one file so tables never import each other in a cycle.
 */
export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	posts: many(posts),
	files: many(files),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
	posts: many(posts),
}))

export const postsRelations = relations(posts, ({ one }) => ({
	author: one(users, { fields: [posts.authorId], references: [users.id] }),
	category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
}))

export const filesRelations = relations(files, ({ one }) => ({
	owner: one(users, { fields: [files.ownerId], references: [users.id] }),
}))

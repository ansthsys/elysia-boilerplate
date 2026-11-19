import { timestamps } from '../columns'
import { column, index, table } from '../dialect'
import { users } from './auth'
import { categories } from './categories'

export const posts = table(
	'posts',
	{
		id: column.id(),
		title: column.string('title', 200).notNull(),
		content: column.text('content').notNull(),
		categoryId: column
			.foreignId('category_id')
			.notNull()
			// restrict: a category that still has posts cannot be deleted (see CategoryService.remove)
			.references(() => categories.id, { onDelete: 'restrict' }),
		/** Date-only column example: stored as text on every dialect, never shifted by a timezone. */
		publishedOn: column.date('published_on'),
		authorId: column
			.foreignId('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps(),
	},
	(t) => [index('posts_category_id_idx').on(t.categoryId), index('posts_author_id_idx').on(t.authorId)],
)

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert

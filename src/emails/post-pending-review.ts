import { env } from '#config/env'
import { escapeHtml } from '#lib/mailer'
import { emailLayout } from './layout'

export interface PostPendingReviewData {
	postId: string
	title: string
	authorName: string
	categoryName: string
}

/**
 * Sent to every admin when a member submits a post. The approval action is the
 * existing `PATCH /api/posts/:id` with a `publishedOn` date, so this template
 * only has to link reviewers to the post.
 */
export function postPendingReviewEmail(data: PostPendingReviewData) {
	const reviewUrl = `${env.APP_URL}/api/posts/${data.postId}`
	const title = `Post pending review: ${data.title}`

	const text = [
		'A new post is waiting for approval.',
		'',
		`Title:    ${data.title}`,
		`Author:   ${data.authorName}`,
		`Category: ${data.categoryName}`,
		`Review:   ${reviewUrl}`,
		'',
		'Publish it by sending PATCH /api/posts/{id} with a "publishedOn" date.',
	].join('\n')

	const html = emailLayout({
		title: 'Post pending review',
		intro: 'A new post is waiting for approval.',
		body: `<table style="width:100%;font-size:14px;border-collapse:collapse">
			<tr><td style="padding:4px 0;color:#64748b">Title</td><td style="padding:4px 0">${escapeHtml(data.title)}</td></tr>
			<tr><td style="padding:4px 0;color:#64748b">Author</td><td style="padding:4px 0">${escapeHtml(data.authorName)}</td></tr>
			<tr><td style="padding:4px 0;color:#64748b">Category</td><td style="padding:4px 0">${escapeHtml(data.categoryName)}</td></tr>
		</table>
		<p style="margin:16px 0 0;font-size:13px;color:#475569">Publish it with <code>PATCH /api/posts/{id}</code> and a <code>publishedOn</code> date.</p>`,
		action: { label: 'Review post', url: reviewUrl },
	})

	return { subject: title, text, html }
}

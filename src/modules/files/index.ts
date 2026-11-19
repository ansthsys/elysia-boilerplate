import { Elysia } from 'elysia'
import { errorResponses, ok } from '#core/http'
import { authGuard } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { FileModel } from './model'
import { FileService } from './service'

/**
 * Files - example of storage that is driver-independent:
 * - `STORAGE_DRIVER=local` writes under `STORAGE_LOCAL_PATH` and serves through
 *   `/raw` with an HMAC-signed URL;
 * - `STORAGE_DRIVER=s3` signs with the provider (presigned URL), so `/raw` is
 *   never used.
 *
 * The database stores metadata only; bytes never live in a row.
 */
export const filesModule = new Elysia({ prefix: '/api/files', detail: { tags: ['Files'] } })
	.use(errorHandler)
	.use(authGuard)
	.get(
		'/raw',
		async ({ query }) => {
			const { blob, file } = await FileService.open(query.key, query.exp, query.sig)
			const headers = new Headers({
				'content-type': file.mime,
				'content-length': String(file.size),
				'cache-control': 'private, max-age=60',
			})
			if (file.originalName) {
				headers.set('content-disposition', `inline; filename="${file.originalName.replaceAll('"', '')}"`)
			}
			return new Response(blob, { headers })
		},
		{
			query: FileModel.rawQuery,
			response: { ...errorResponses(403, 404, 422) },
			detail: {
				summary: 'Download a file with a signed URL',
				description:
					'Used by the local driver. With the S3 driver, `/api/files/:id/url` returns a presigned provider URL instead.',
			},
		},
	)
	.post('', async ({ body, user, status }) => status(201, ok(await FileService.upload(body, user))), {
		auth: true,
		body: FileModel.upload,
		response: { 201: FileModel.fileResponse, ...errorResponses(401, 422) },
		detail: {
			summary: 'Upload a file',
			description: 'multipart/form-data (`file`, optional `visibility`). Only metadata is stored in the database.',
		},
	})
	.get('/:id', async ({ params }) => ok(await FileService.findById(params.id)), {
		params: FileModel.params,
		response: { 200: FileModel.fileResponse, ...errorResponses(404, 422) },
		detail: { summary: 'Get file metadata' },
	})
	.get('/:id/url', async ({ params, user }) => ok(await FileService.signedUrl(params.id, user)), {
		auth: true,
		params: FileModel.params,
		response: { 200: FileModel.urlResponse, ...errorResponses(401, 403, 404, 422) },
		detail: {
			summary: 'Get a signed download URL',
			description: 'Private files are owner-only (or `file:delete`); public files are readable by any signed-in user.',
		},
	})
	.delete(
		'/:id',
		async ({ params, user }) => {
			await FileService.remove(params.id, user)
			return ok(null)
		},
		{
			auth: true,
			params: FileModel.params,
			response: { 200: FileModel.deleteResponse, ...errorResponses(401, 403, 404, 422) },
			detail: { summary: 'Delete a file', description: 'Allowed for the owner, or with `file:delete` (admin).' },
		},
	)

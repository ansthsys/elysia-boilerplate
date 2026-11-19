import { t } from 'elysia'
import { env } from '#config/env'
import { idParams } from '#core/schemas'
import { files } from '#db/schema/index'
import { createSelectSchema } from '#db/typebox'
import { successSchema } from '#shared'

/** Elysia's `FileUnit` is not exported from the package root, so it is repeated here. */
type FileUnit = number | `${number}${'k' | 'm'}`

/**
 * Whitelist, enforced in the service (422 on `file`).
 *
 * Why not `t.File({ type: [...] })`? That makes Elysia sniff the content with
 * the optional `file-type` package, and types without magic bytes (plain
 * text, for example) are always rejected. The declared MIME is validated
 * here instead; if you need content sniffing, install `file-type` and add
 * `type` back to `t.File`.
 */
export const ALLOWED_MIME_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'application/pdf',
	'text/plain',
] as const

const maxSize = env.STORAGE_MAX_FILE_SIZE as FileUnit

const fileRow = createSelectSchema(files)

/**
 * `key` never leaves the server (clients address files by id and receive a
 * signed URL), and `ownerId` is only needed by the service.
 */
const FileSchema = t.Omit(fileRow, ['key', 'ownerId'])

export const FileModel = {
	upload: t.Object({
		file: t.File({ maxSize, error: 'File is larger than STORAGE_MAX_FILE_SIZE' }),
		visibility: t.Optional(t.Union([t.Literal('private'), t.Literal('public')], { default: 'private' })),
	}),
	params: idParams('file'),
	/** Query of the signed-download route: the signature is the authorization. */
	rawQuery: t.Object({
		key: t.String({ minLength: 1, maxLength: 512 }),
		exp: t.Integer({ minimum: 1, description: 'Unix timestamp (seconds) when the URL expires' }),
		sig: t.String({ minLength: 64, maxLength: 64, description: 'HMAC-SHA256 of "key:exp"' }),
	}),
	file: FileSchema,
	fileResponse: successSchema(FileSchema),
	urlResponse: successSchema(
		t.Object({
			url: t.String({ format: 'uri', description: 'Signed URL, valid for `expiresIn` seconds' }),
			expiresIn: t.Integer(),
		}),
	),
	deleteResponse: successSchema(t.Null()),
} as const

export type FileModel = {
	[K in keyof typeof FileModel]: (typeof FileModel)[K]['static']
}

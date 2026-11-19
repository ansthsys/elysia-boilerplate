import { env } from '#config/env'
import type { StorageDriver } from './types'

let client: Bun.S3Client | null = null

/** Created lazily: importing the module must not require S3 credentials. */
function s3() {
	if (client) return client
	if (!env.S3_BUCKET || !env.S3_REGION) throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET and S3_REGION')

	client = new Bun.S3Client({
		bucket: env.S3_BUCKET,
		region: env.S3_REGION,
		// Left undefined on AWS S3; set for R2, MinIO, Spaces...
		endpoint: env.S3_ENDPOINT || undefined,
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		// Path-style by default: MinIO and most non-AWS endpoints need it.
		virtualHostedStyle: env.S3_VIRTUAL_HOSTED_STYLE,
	})
	return client
}

/** S3-compatible driver via Bun's built-in client (no dependency). */
export const s3Driver: StorageDriver = {
	name: 's3',

	async put(key, data, options) {
		const size = await s3().write(key, data, options?.type ? { type: options.type } : undefined)
		return { key, disk: 's3', size, type: options?.type }
	},

	async read(key) {
		const file = s3().file(key)
		return new Blob([await file.arrayBuffer()], { type: file.type })
	},

	async delete(key) {
		await s3().delete(key)
	},

	exists(key) {
		return s3().file(key).exists()
	},

	signedUrl(key, options) {
		return s3().presign(key, { expiresIn: options?.expiresIn ?? 3600 })
	},

	async presignPut(key, options) {
		const expiresIn = options?.expiresIn ?? 900
		const url = s3().presign(key, {
			method: 'PUT',
			expiresIn,
			...(options?.type ? { type: options.type } : {}),
		})
		return { url, method: 'PUT', expiresIn, ...(options?.type ? { headers: { 'content-type': options.type } } : {}) }
	},
}

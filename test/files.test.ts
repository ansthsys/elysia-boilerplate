import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { app } from '#app'
import { env } from '#config/env'
import { s3Driver, signStorageKey } from '#lib/storage'
import { actingAs, api } from './helpers'

const textFile = (content: string, name = 'note.txt', type = 'text/plain') => new File([content], name, { type })

afterAll(async () => {
	await rm(env.STORAGE_LOCAL_PATH, { recursive: true, force: true })
})

describe('files (local driver)', () => {
	it('uploads a file and returns metadata without the storage key', async () => {
		const { user, headers } = await actingAs()
		const { data, status } = await api.api.files.post({ file: textFile('hello storage') }, { headers })

		expect(status).toBe(201)
		expect(data?.data).toMatchObject({
			mime: 'text/plain',
			size: 13,
			visibility: 'private',
			originalName: 'note.txt',
		})
		expect(data?.data).not.toHaveProperty('key')
		expect(data?.data).not.toHaveProperty('ownerId')
		expect(data?.data.id).toBeDefined()
		expect(user.id).toBeDefined()
	})

	it('serves the bytes through a signed URL and rejects a tampered or expired one', async () => {
		const { headers } = await actingAs()
		const upload = await api.api.files.post({ file: textFile('signed content') }, { headers })
		const id = upload.data?.data.id as string

		const signed = await api.api.files({ id }).url.get({ headers })
		expect(signed.status).toBe(200)
		const url = signed.data?.data.url as string

		const download = await app.handle(new Request(url))
		expect(download.status).toBe(200)
		expect(download.headers.get('content-type')).toBe('text/plain')
		expect(await download.text()).toBe('signed content')

		const tampered = new URL(url)
		tampered.searchParams.set('sig', '0'.repeat(64))
		expect((await app.handle(new Request(tampered.toString()))).status).toBe(403)

		const key = new URL(url).searchParams.get('key') as string
		const expiredAt = Math.floor(Date.now() / 1000) - 10
		const expired = new URL(url)
		expired.searchParams.set('exp', String(expiredAt))
		expired.searchParams.set('sig', signStorageKey(key, expiredAt))
		expect((await app.handle(new Request(expired.toString()))).status).toBe(403)
	})

	it('rejects a file type outside the whitelist (422)', async () => {
		const { headers } = await actingAs()
		const { status, error } = await api.api.files.post(
			{ file: textFile('<svg/>', 'x.svg', 'image/svg+xml') },
			{ headers },
		)

		expect(status).toBe(422)
		expect(error?.value.error.details?.[0]?.field).toBe('file')
	})

	it('rejects a file larger than STORAGE_MAX_FILE_SIZE (422)', async () => {
		const { headers } = await actingAs()
		const tooBig = new File([new Uint8Array(6 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })
		const { status, error } = await api.api.files.post({ file: tooBig }, { headers })

		expect(status).toBe(422)
		expect(error?.value.error.details?.[0]?.field).toBe('file')
	})

	it('lets only the owner or an admin delete, and removes the bytes', async () => {
		const owner = await actingAs('member')
		const stranger = await actingAs('member')
		const admin = await actingAs('admin')

		const upload = await api.api.files.post({ file: textFile('to delete') }, { headers: owner.headers })
		const id = upload.data?.data.id as string
		const url = (await api.api.files({ id }).url.get({ headers: owner.headers })).data?.data.url as string

		expect((await api.api.files({ id }).delete(undefined, { headers: stranger.headers })).status).toBe(403)
		expect((await api.api.files({ id }).delete(undefined, { headers: admin.headers })).status).toBe(200)
		expect((await api.api.files({ id }).get()).status).toBe(404)

		// The row is gone, so even a still-valid signature cannot resurrect the file.
		expect((await app.handle(new Request(url))).status).toBe(404)
	})

	it('requires a session for the signed URL and keeps private files owner-only', async () => {
		const owner = await actingAs('member')
		const stranger = await actingAs('member')

		const privateUpload = await api.api.files.post({ file: textFile('top secret') }, { headers: owner.headers })
		const privateId = privateUpload.data?.data.id as string

		expect((await api.api.files({ id: privateId }).url.get()).status).toBe(401)
		expect((await api.api.files({ id: privateId }).url.get({ headers: stranger.headers })).status).toBe(403)
		expect((await api.api.files({ id: privateId }).url.get({ headers: owner.headers })).status).toBe(200)

		const publicUpload = await api.api.files.post(
			{ file: textFile('shared'), visibility: 'public' },
			{ headers: owner.headers },
		)
		const publicId = publicUpload.data?.data.id as string
		expect((await api.api.files({ id: publicId }).url.get({ headers: stranger.headers })).status).toBe(200)
	})

	it('requires a session to upload', async () => {
		const { status } = await api.api.files.post({ file: textFile('anonymous') })
		expect(status).toBe(401)
	})
})

/** Opt-in: runs only when the S3/MinIO variables are present (docker compose --profile s3). */
const s3Ready = Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID)

describe.skipIf(!s3Ready)('s3 driver', () => {
	it('puts, reads, signs and deletes an object', async () => {
		const key = `tests/${crypto.randomUUID()}.txt`
		const stored = await s3Driver.put(key, new TextEncoder().encode('minio content'), { type: 'text/plain' })

		expect(stored).toMatchObject({ key, disk: 's3', size: 13, type: 'text/plain' })
		expect(await s3Driver.exists(key)).toBe(true)
		expect(await (await s3Driver.read(key)).text()).toBe('minio content')

		const url = await s3Driver.signedUrl(key, { expiresIn: 60 })
		expect(url).toContain(key)

		await s3Driver.delete(key)
		expect(await s3Driver.exists(key)).toBe(false)
	})
})

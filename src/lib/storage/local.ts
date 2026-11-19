import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { env } from '#config/env'
import { signStorageKey } from './sign'
import type { StorageDriver } from './types'

/** Route that serves local objects: the files module must register it. */
export const LOCAL_SIGNED_ROUTE = '/api/files/raw'

const root = () => resolve(env.STORAGE_LOCAL_PATH)
const publicBaseUrl = () => (env.STORAGE_PUBLIC_BASE_URL || env.APP_URL).replace(/\/$/, '')

/**
 * Keys are always app-generated (`files/<id>`), so anything with traversal
 * tricks, empty segments or a leading slash is a bug and is rejected instead
 * of being normalised into something that escapes the root.
 */
function pathFor(key: string) {
	const segments = key.split('/')
	if (!key || key.startsWith('/') || key.includes('\\') || segments.some((s) => !s || s === '.' || s === '..')) {
		throw new Error(`Invalid storage key "${key}"`)
	}

	const base = root()
	const path = resolve(base, key)
	if (path !== base && !path.startsWith(`${base}${sep}`)) throw new Error(`Invalid storage key "${key}"`)
	return path
}

/**
 * Filesystem driver: fine for Docker with a volume and for local development.
 * Not usable on serverless (the filesystem is ephemeral/read-only), which is
 * why `STORAGE_DRIVER=s3` exists.
 */
export const localDriver: StorageDriver = {
	name: 'local',

	async put(key, data, options) {
		const path = pathFor(key)
		await mkdir(dirname(path), { recursive: true })
		const size = await Bun.write(path, data)
		return { key, disk: 'local', size, type: options?.type }
	},

	async read(key) {
		const file = Bun.file(pathFor(key))
		if (!(await file.exists())) throw new Error(`Storage object not found: ${key}`)
		return file
	},

	async delete(key) {
		await rm(pathFor(key), { force: true })
	},

	exists(key) {
		return Bun.file(pathFor(key)).exists()
	},

	signedUrl(key, options) {
		const exp = Math.floor(Date.now() / 1000) + (options?.expiresIn ?? 3600)
		const params = new URLSearchParams({ key, exp: String(exp), sig: signStorageKey(key, exp) })
		return `${publicBaseUrl()}${LOCAL_SIGNED_ROUTE}?${params}`
	},
}

import { env } from '#config/env'
import { localDriver } from './storage/local'
import { s3Driver } from './storage/s3'
import type { DiskName, StorageDriver } from './storage/types'

/**
 * Disk registry, Laravel-style:
 *
 *   storage.disk()        → the driver selected by STORAGE_DRIVER (default local)
 *   storage.disk('s3')    → a specific disk, e.g. for object storage
 *
 * This facade lives at `src/lib/storage.ts` (drivers in `src/lib/storage/`) so
 * `#lib/storage` resolves through the same `#*` alias as every other import.
 * Application code only talks to this module: no `Bun.write`, no S3 SDK calls
 * inside modules.
 */
const drivers: Record<DiskName, StorageDriver> = {
	local: localDriver,
	s3: s3Driver,
}

export const storage = {
	disk: (name: DiskName = env.STORAGE_DRIVER) => drivers[name],
}

export { LOCAL_SIGNED_ROUTE, localDriver } from './storage/local'
export { s3Driver } from './storage/s3'
export { signStorageKey, verifyStorageKey } from './storage/sign'
export type * from './storage/types'

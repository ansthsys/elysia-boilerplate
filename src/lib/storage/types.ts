export type DiskName = 'local' | 's3'
export type Visibility = 'private' | 'public'
export type PutData = File | Blob | Uint8Array | ArrayBuffer

export interface PutOptions {
	/** MIME type stored alongside the object, when the driver supports metadata. */
	type?: string
	visibility?: Visibility
}

export interface StoredObject {
	key: string
	disk: DiskName
	size: number
	type?: string
}

export interface SignedUrlOptions {
	/** Seconds until the URL stops working. Default 1 hour. */
	expiresIn?: number
}

export interface PresignedUpload {
	url: string
	method: 'PUT'
	headers?: Record<string, string>
	expiresIn: number
}

/**
 * One contract for every driver, so the module layer never branches on
 * "local vs S3". Keys are driver-independent (`files/<id>`), which is what
 * makes migrating local → S3 a config change instead of a rewrite.
 */
export interface StorageDriver {
	readonly name: DiskName
	put(key: string, data: PutData, options?: PutOptions): Promise<StoredObject>
	read(key: string): Promise<Blob>
	delete(key: string): Promise<void>
	exists(key: string): Promise<boolean>
	signedUrl(key: string, options?: SignedUrlOptions): Promise<string> | string
	/** Direct browser upload (the serverless-friendly path); not every driver has it. */
	presignPut?(key: string, options?: SignedUrlOptions & { type?: string }): Promise<PresignedUpload>
}

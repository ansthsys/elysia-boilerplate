import { env } from '#config/env'
import { type Actor, can } from '#core/access'
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from '#core/errors'
import { newId } from '#db/id'
import type { FileRecord } from '#db/schema/index'
import { storage, verifyStorageKey } from '#lib/storage'
import { ALLOWED_MIME_TYPES, type FileModel } from './model'
import { FileRepository } from './repository'

/** Public shape: the storage key and the owner id stay server-side. */
const toPublic = ({ key: _key, ownerId: _ownerId, ...file }: FileRecord) => file

/**
 * File metadata + storage orchestration. Every driver interaction goes
 * through `storage.disk()`; nothing here knows whether the bytes are on disk
 * or in an S3-compatible bucket.
 */
export abstract class FileService {
	static async upload(input: FileModel['upload'], owner: Actor) {
		// Multipart clients may append parameters ("text/plain;charset=utf-8"):
		// the whitelist and the stored metadata use the bare type.
		const mime = (input.file.type || 'application/octet-stream').split(';')[0]?.trim() || 'application/octet-stream'
		if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
			throw UnprocessableEntityError.field('file', `Unsupported file type "${mime}"`)
		}

		const visibility = input.visibility ?? 'private'
		const disk = env.STORAGE_DRIVER
		const key = `files/${newId()}`

		const stored = await storage.disk(disk).put(key, input.file, { type: input.file.type, visibility })
		const id = await FileRepository.create({
			key,
			disk,
			mime,
			size: stored.size,
			originalName: input.file.name || null,
			visibility,
			ownerId: owner.id,
		})
		return FileService.findById(id)
	}

	static async findById(id: string) {
		const file = await FileRepository.findById(id)
		if (!file) throw new NotFoundError('File')
		return toPublic(file)
	}

	/**
	 * A private file is only readable by its owner (or an admin with
	 * `file:delete`). A public file can be read by any signed-in user.
	 */
	static async signedUrl(id: string, actor: Actor, expiresIn = 3600) {
		const file = await FileRepository.findById(id)
		if (!file) throw new NotFoundError('File')

		const privileged = file.ownerId === actor.id || can(actor.role, { file: ['delete'] })
		if (file.visibility === 'private' && !privileged) {
			throw new ForbiddenError('This file is private')
		}

		const url = await storage.disk(file.disk).signedUrl(file.key, { expiresIn })
		return { url, expiresIn }
	}

	/** Owner, or an admin with `file:delete`. Bytes are removed before the row. */
	static async remove(id: string, actor: Actor) {
		const file = await FileRepository.findById(id)
		if (!file) throw new NotFoundError('File')
		if (file.ownerId !== actor.id && !can(actor.role, { file: ['delete'] })) {
			throw new ForbiddenError('You can only delete your own files')
		}

		await storage.disk(file.disk).delete(file.key)
		await FileRepository.delete(id)
	}

	/** Serves a local signed URL. The signature and expiry are the authorization. */
	static async open(key: string, exp: number, sig: string) {
		if (!verifyStorageKey(key, exp, sig)) throw new ForbiddenError('Invalid or expired URL')

		const file = await FileRepository.findByKey(key)
		if (!file) throw new NotFoundError('File')
		return { blob: await storage.disk(file.disk).read(key), file }
	}
}

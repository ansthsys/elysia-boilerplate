import { eq } from 'drizzle-orm'
import { db } from '#db/client'
import { guardUnique } from '#db/errors'
import { newId } from '#db/id'
import { type FileRecord, files, type NewFile } from '#db/schema/index'

/** Data access for files: every Drizzle query of the module lives here. */
export abstract class FileRepository {
	static findById(id: string): Promise<FileRecord | undefined> {
		return db.query.files.findFirst({ where: eq(files.id, id) })
	}

	static findByKey(key: string): Promise<FileRecord | undefined> {
		return db.query.files.findFirst({ where: eq(files.key, key) })
	}

	/** @throws UniqueConstraintError when the generated key collides. */
	static async create(values: Omit<NewFile, 'id'>): Promise<string> {
		const id = newId()
		await guardUnique(() => db.insert(files).values({ ...values, id }))
		return id
	}

	static async delete(id: string): Promise<void> {
		await db.delete(files).where(eq(files.id, id))
	}
}

import type { InferInsertModel } from 'drizzle-orm'
import { db } from '../client'
import type { AnyTable } from '../dialect'
import { newId } from '../id'

type Row<TTable extends AnyTable> = InferInsertModel<TTable> & { id: string }

/**
 * Minimal model factory (Laravel style). A factory only knows how to build a
 * valid row with fake data; seeders and tests decide how many and with what
 * overrides.
 *
 *   postFactory.make({ title: 'Fixed title' })       // object only, no DB
 *   await postFactory.create({ authorId, categoryId }) // inserted row
 *   await postFactory.createMany(10, { authorId, categoryId })
 */
export function defineFactory<TTable extends AnyTable>(
	table: TTable,
	definition: () => Omit<InferInsertModel<TTable>, 'id'>,
) {
	const make = (overrides: Partial<InferInsertModel<TTable>> = {}): Row<TTable> =>
		({ id: newId(), ...definition(), ...overrides }) as Row<TTable>

	const makeMany = (count: number, overrides: Partial<InferInsertModel<TTable>> = {}) =>
		Array.from({ length: count }, () => make(overrides))

	const insert = async (rows: Row<TTable>[]) => {
		await db.insert(table).values(rows)
		return rows
	}

	return {
		make,
		makeMany,
		create: async (overrides: Partial<InferInsertModel<TTable>> = {}) =>
			(await insert([make(overrides)]))[0] as Row<TTable>,
		createMany: async (count: number, overrides: Partial<InferInsertModel<TTable>> = {}) =>
			count > 0 ? insert(makeMany(count, overrides)) : [],
	}
}

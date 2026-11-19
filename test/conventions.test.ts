import { describe, expect, it } from 'bun:test'
import { readdir } from 'node:fs/promises'

/**
 * Architecture rules, enforced as tests. These are the rules the skill and
 * docs describe; a comment is not enough, because a rule that only lives in
 * prose is the first thing an AI agent (or a hurried human) breaks.
 *
 * When one of these fails, fix the code - do not relax the test.
 */
const ROOT = `${import.meta.dir}/..`

async function sources(pattern: string): Promise<{ path: string; text: string }[]> {
	const paths: string[] = []
	for await (const path of new Bun.Glob(pattern).scan({ cwd: ROOT })) paths.push(path)
	return Promise.all(paths.sort().map(async (path) => ({ path, text: await Bun.file(`${ROOT}/${path}`).text() })))
}

describe('module layout', () => {
	it('every module has a model.ts', async () => {
		const entries = await readdir(`${ROOT}/src/modules`, { withFileTypes: true })
		const modules = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

		expect(modules.length).toBeGreaterThan(0)
		for (const name of modules) {
			const exists = await Bun.file(`${ROOT}/src/modules/${name}/model.ts`).exists()
			expect({ module: name, model: exists }).toEqual({ module: name, model: true })
		}
	})

	it('controllers never declare schemas (no `t.` in a module index.ts)', async () => {
		const violations: string[] = []
		for (const { path, text } of await sources('src/modules/*/index.ts')) {
			if (/\bt\.[A-Z]/.test(text)) violations.push(path)
		}
		expect(violations).toEqual([])
	})
})

describe('portability', () => {
	it('process.env is only read in src/config/env.ts', async () => {
		const violations: string[] = []
		for (const { path, text } of await sources('src/**/*.ts')) {
			if (path === 'src/config/env.ts') continue
			if (/process\.env/.test(text)) violations.push(path)
		}
		expect(violations).toEqual([])
	})

	it('dialect packages are only imported by src/db/dialects', async () => {
		const violations: string[] = []
		for (const { path, text } of await sources('src/**/*.ts')) {
			if (path.startsWith('src/db/dialects/')) continue
			if (/from 'drizzle-orm\/[a-z-]+-core'/.test(text)) violations.push(path)
		}
		expect(violations).toEqual([])
	})

	it('never uses .returning() (MySQL has no RETURNING)', async () => {
		const violations: string[] = []
		for (const { path, text } of await sources('src/**/*.ts')) {
			if (/\.returning\(/.test(text)) violations.push(path)
		}
		expect(violations).toEqual([])
	})

	it('every dialect exposes the same column builders', async () => {
		const dialects = ['postgres', 'mysql', 'sqlite'] as const
		const keys = new Map<string, string[]>()

		for (const name of dialects) {
			const text = await Bun.file(`${ROOT}/src/db/dialects/${name}.ts`).text()
			const block = text.match(/export const column = \{([\s\S]*?)\n\}/)?.[1]
			expect({ dialect: name, block: block !== undefined }).toEqual({ dialect: name, block: true })
			keys.set(
				name,
				[...(block ?? '').matchAll(/^\t([A-Za-z]+):/gm)].map((match) => match[1] ?? ''),
			)
		}

		const reference = keys.get('postgres')
		expect(reference).toBeDefined()
		for (const name of ['mysql', 'sqlite'] as const) {
			expect({ dialect: name, keys: keys.get(name) }).toEqual({ dialect: name, keys: reference })
		}
		expect(reference).toEqual(expect.arrayContaining(['date', 'time', 'json', 'enum', 'timestamp']))
	})
})

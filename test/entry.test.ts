import { describe, expect, it } from 'bun:test'

async function probe() {
	const child = Bun.spawn(['bun', 'run', `${import.meta.dir}/fixtures/vercel-entry.ts`], {
		env: { ...process.env, VERCEL: '1' },
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])
	if (code !== 0) throw new Error(`fixture failed (${code}):\n${stderr}`)
	return JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}')
}

describe('Vercel entry', () => {
	it('exports the app as the handler without opening a listener', async () => {
		// If the `import.meta.main && !env.VERCEL` guard regressed, the imported
		// entry would call `listen` and `app.server` would be set.
		expect(await probe()).toEqual({ status: 200, listening: false })
	})
})

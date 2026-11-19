import { stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

/**
 * Measures the server bundle against `BUNDLE_BUDGET_KB` (default 600 kB gzip).
 *
 * Run `bun run build` first; CI does exactly that. This is a regression guard
 * for dependency weight and import-time work, not a billing metric: it does not
 * change the artifact, so it has no effect on runtime or cold start.
 */
const path = 'dist/index.js'
const budgetKb = Number(process.env.BUNDLE_BUDGET_KB ?? 600)

if (!(await Bun.file(path).exists())) {
	console.error(`${path} is missing. Run \`bun run build\` first.`)
	process.exit(1)
}

const raw = (await stat(path)).size
const gzipKb = Math.round(gzipSync(new Uint8Array(await Bun.file(path).arrayBuffer())).length / 1024)

console.log(`${path}: ${Math.round(raw / 1024)} kB raw, ${gzipKb} kB gzip (budget ${budgetKb} kB)`)

if (gzipKb > budgetKb) {
	console.error(`Bundle budget exceeded: ${gzipKb} kB > ${budgetKb} kB.`)
	process.exit(1)
}

// @ts-nocheck
/**
 * Vercel entry.
 *
 * The platform's Elysia builder transpiles source files but does not rewrite
 * the `#` subpath imports, so it cannot run `src/app.ts` directly. This thin
 * entry imports the prebuilt, self-contained bundle instead. `bun run build`
 * runs before Vercel builds this function (see `package.json`).
 *
 * Local development and tests keep using `src/index.ts`.
 */
import type { Elysia } from 'elysia'
import app from './dist/index.js'

export default app as Elysia

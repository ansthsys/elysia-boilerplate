// @ts-nocheck
/**
 * Vercel entry.
 *
 * Vercel's Elysia builder transpiles source files individually but does not
 * rewrite the template's `#` subpath imports, so it cannot run `src/app.ts`
 * directly. This entry imports the self-contained `dist/index.js` produced by
 * `bun run build`. `src/index.ts` remains the Bun listener for local dev and
 * Docker; application code must not import this file.
 */
import type { Elysia } from 'elysia'
import app from './dist/index.js'

export default app as Elysia

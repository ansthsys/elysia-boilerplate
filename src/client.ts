/**
 * Entry point for API consumers (frontends, other services, tests).
 *
 * Type-only on purpose: `import type` from this file is erased at build time,
 * so no server code ever ends up in a client bundle.
 *
 *   import type { App, ErrorResponse } from '<this-package>/client'
 *   const api = treaty<App>('http://localhost:3000')
 *
 * Runtime helpers that are safe on the client (error codes, permission checks)
 * are exported separately from `<this-package>/shared`. See docs/client.md.
 */
export type { App } from './app'
export type * from './shared'

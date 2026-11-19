/**
 * Imports the real server entry the way Vercel does (default export) and
 * reports whether a listener was opened. Run in a child process so `VERCEL=1`
 * does not leak into the rest of the suite.
 */
import app from '../../src/index'

const before = app.server
const response = await app.handle(new Request('http://localhost/health'))
const after = app.server

console.log(JSON.stringify({ status: response.status, listening: before !== null || after !== null }))
process.exit(0)

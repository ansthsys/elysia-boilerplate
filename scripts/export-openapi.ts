import { app } from '#app'
import { database } from '#db/client'

/**
 * Writes the OpenAPI spec to openapi.json without starting a server.
 * Clients in other repositories generate their types from it
 * (see examples/standalone-client). Usage: `bun openapi:export`
 */
const response = await app.handle(new Request('http://localhost/docs/json'))
if (!response.ok) throw new Error(`Could not export OpenAPI spec (status ${response.status}). Is OPENAPI_ENABLED=true?`)

const path = `${import.meta.dir}/../openapi.json`
await Bun.write(path, `${JSON.stringify(await response.json(), null, '\t')}\n`)
console.log(`OpenAPI spec written to ${path}`)
await database.close()

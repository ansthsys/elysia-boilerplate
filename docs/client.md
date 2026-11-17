# Using the API from a frontend

The API exports two entry points (see `exports` in `package.json`):

| Import                      | Contains                                                                                         | Runtime cost                                |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `elysia-boilerplate/client` | `type App` (for Eden) and every shared **type** (`ErrorResponse`, `PaginationMeta`, `Role`, ...) | none: type only                             |
| `elysia-boilerplate/shared` | client-safe values: `ErrorCode`, `hasPermission`, `hasRole`, `roles`, pagination constants       | small: TypeBox + Better Auth access control |

Pick the setup that matches where the frontend lives.

## 1. Backend and frontend side by side (`./be` + `./fe`)

```
my-project/
├── be/   ← this repository
└── fe/   ← your frontend (Vite, Next.js, Nuxt, ...)
```

Install Eden in the frontend:

```bash
cd fe && bun add @elysiajs/eden
```

Point TypeScript at the backend in `fe/tsconfig.json`:

```jsonc
{
	"compilerOptions": {
		"moduleResolution": "bundler",
		"strict": true,
		"paths": {
			"@be/*": ["../be/src/*"],
			// One Elysia for both sides. Without this the frontend's own copy and the
			// backend's copy are different types and `treaty<App>` fails to type-check.
			"elysia": ["../be/node_modules/elysia"]
		}
	}
}
```

Create the client:

```ts
// fe/src/lib/api.ts
import { treaty } from '@elysiajs/eden'
import type { App } from '@be/client'

export const api = treaty<App>(import.meta.env.VITE_API_URL, {
	fetch: { credentials: 'include' }, // send the Better Auth session cookie
})
```

Run `bun install` in `be/` once, because the frontend reads types from `be/node_modules`. Add the frontend origin to `CORS_ORIGINS` in `be/.env`.

> Alternative: make `my-project/` a Bun workspace (`"workspaces": ["be", "fe"]`). A single install then shares one `elysia` and the `paths` entry for `elysia` is not needed.

## 2. Frontend in a separate repository

### Option A: Eden, with the backend as a dev dependency

The frontend installs this repository only to read its types. `import type` is erased at build time, so no backend code is bundled.

```bash
bun add @elysiajs/eden
bun add -d github:<you>/elysia-boilerplate   # or a private registry / file:../path
```

```jsonc
// tsconfig.json
{
	"compilerOptions": {
		"paths": {
			// same reason as above; ignored when Elysia is already hoisted
			"elysia": ["./node_modules/elysia-boilerplate/node_modules/elysia"]
		}
	}
}
```

```ts
import { treaty } from '@elysiajs/eden'
import type { App, ErrorResponse } from 'elysia-boilerplate/client'
import { ErrorCode, hasPermission } from 'elysia-boilerplate/shared'

export const api = treaty<App>('https://api.example.com', { fetch: { credentials: 'include' } })
```

Update the dependency (`bun update elysia-boilerplate`) to pick up API changes. Keep the frontend's `@elysiajs/eden` on the version listed in this repo's `package.json`.

### Option B: types generated from OpenAPI (no backend code at all)

Use this when the frontend must not depend on the backend repository, or is not written in TypeScript with Eden.

```bash
# in this repo (no server needed): writes openapi.json
bun openapi:export

# in the frontend
bun add openapi-fetch
bun add -d openapi-typescript typescript@5      # openapi-typescript needs TypeScript 5's compiler API
bunx openapi-typescript https://api.example.com/docs/json -o src/api.d.ts
```

```ts
import createClient from 'openapi-fetch'
import type { components, paths } from './api'

export const api = createClient<paths>({ baseUrl: 'https://api.example.com', credentials: 'include' })
export type ErrorResponse = components['schemas']['ErrorResponse']

const { data, error, response } = await api.POST('/api/posts', { body: { title, content, categoryId } })
```

Regenerate `api.d.ts` whenever the API changes (for example in CI).

## Calling the API

The examples use Eden; the response shapes are the same with OpenAPI.

```ts
// list with pagination
const { data, error } = await api.api.posts.get({ query: { page: 1, limit: 20 } })
if (error) throw new Error(error.value.error.message)
data.data // Post[] (typed, dates parsed into Date)
data.meta.nextPage // number | null: load more while it is not null

// form submit with field errors
const { data, error } = await api.api.posts.post({ title, content, categoryId })
if (error?.status === 422) {
	// { title: 'Title must be between 3 and 200 characters', categoryId: 'Category does not exist' }
	const fieldErrors = Object.fromEntries((error.value.error.details ?? []).map((d) => [d.field, d.message]))
}
if (error?.status === 401) redirect('/login')

// path params
await api.api.posts({ id }).patch({ title: 'New title' })
await api.api.posts({ id }).delete()
```

`error.status` and `error.value` are typed from each route's `response` schema. Branch on `error.value.error.code` (stable), not on `message`.

Authentication endpoints (`/api/auth/*`) are served by Better Auth and are not part of `App`. Use Better Auth's client in the frontend:

```ts
import { createAuthClient } from 'better-auth/client'
import { adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ baseURL: 'https://api.example.com', plugins: [adminClient()] })
await authClient.signIn.email({ email, password })
```

Show or hide UI with the same rules the API enforces:

```ts
import { hasPermission } from '@be/shared' // or 'elysia-boilerplate/shared'
const canDelete = post.authorId === me.id || hasPermission(me.role, { post: ['delete'] })
```

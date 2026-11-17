# Auth, roles & permissions

## Pieces

**`src/lib/auth.ts`** holds the Better Auth instance:

- Drizzle adapter
- email/password sign-in, email verification, password reset
- rate limiting
- plugins, each behind its own switch

**`src/plugins/auth.ts`** has two plugins:

- **`authRoutes`** forwards `/api/auth/*` to Better Auth. A root `.mount(auth.handler)` is avoided on purpose, because it would also catch every unknown route.
- **`authGuard`** provides three **macros**. Handlers receive a fully typed `user` and `session`, with no `any`:

```ts
.get('/me', ({ user }) => user, { auth: true })                      // signed in
.get('/stats', handler, { role: 'admin' })                           // has a role
.post('', handler, { permission: { category: ['create'] } })         // has a permission
```

Each macro also adds the `security` requirement to the OpenAPI docs. A module that uses the macros must `.use(authGuard)` itself. The plugin is named, so it is applied only once.

## Roles & permissions

Roles are defined once in `src/shared/permissions.ts` with Better Auth access control. The API enforces them, and frontends can use the same rules (see [client.md](client.md)).

| Role               | Can                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `member` (default) | create posts and manage **their own** posts (checked in the service)                                    |
| `admin`            | `post:update/delete` on anyone's post, `category:*`, `user:*`/`session:*` (Better Auth admin endpoints) |

Ownership rules depend on data, so they live in the service:

```ts
if (post.authorId === actor.id || can(actor.role, { post: ['update'] })) return
throw new ForbiddenError('You can only update your own posts')
```

To add a resource:

1. Add it to `statements`.
2. Grant its actions to roles.
3. Protect routes with `permission: { resource: ['action'] }`, or check in a service with `can()` from `#core/access`.

Better Auth's admin endpoints are available under `/api/auth/admin/*` and listed in `/docs`: list users, set role, ban, impersonate.

## Switching features on and off

| Setting                    | Effect                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED=false`       | `/api/auth/*` returns 404 and every guarded route returns 401. Public routes keep working.                                                                       |
| `AUTH_ROLES_ENABLED=false` | The admin plugin is not loaded. `role`/`permission` routes return 403 (fail closed) and `can()` is always `false`. Sign-in and `auth: true` routes keep working. |
| `AUTH_BEARER_ENABLED=true` | Bearer plugin: the session token can be sent in the `Authorization` header.                                                                                      |

## Adding a Better Auth plugin

1. Add a switch in `src/config/env.ts`.
2. Append the plugin to the `plugins` array in `src/lib/auth.ts`, using the pattern `...(env.X ? [plugin()] : [])`.
3. If it needs columns or tables:
   - run `bunx @better-auth/cli generate` to see them;
   - add them to `src/db/schema/auth.ts`;
   - run `bun db:generate`.
4. User fields that must stay typed even when the plugin is off belong in `user.additionalFields`. `role` is an example.

# Auth, roles & permissions

## Pieces

**`src/lib/auth.ts`** holds the Better Auth instance:

- Drizzle adapter
- email/password sign-in, email verification, password reset
- rate limiting

**`src/lib/auth-features.ts`** is the switchboard — one entry per capability, and the only place to add a plugin:

- `plugin` is loaded only when the entry is enabled;
- `paths` (relative to `/api/auth`) are hidden when it is disabled;
- `authPlugins` and the hidden-path list are derived from it, so the runtime, `/docs` and the 404s cannot disagree.

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

| Role               | Can                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `member` (default) | create posts and manage **their own** posts (checked in the service)                                                   |
| `admin`            | `post:update/delete` on anyone's post, `category:*`, `file:delete`, `user:*`/`session:*` (Better Auth admin endpoints) |

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

| Setting                             | Effect                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED=false`                | `/api/auth/*` returns 404 and every guarded route returns 401. Public routes keep working.                                                                                       |
| `AUTH_ROLES_ENABLED=false`          | The admin plugin is not loaded. `role`/`permission` routes return 403 with `code: FEATURE_DISABLED` and `can()` is always `false`. Sign-in and `auth: true` routes keep working. |
| `AUTH_BEARER_ENABLED=true`          | Bearer plugin: the session token can be sent in the `Authorization` header. The docs only advertise it when it is on.                                                            |
| `AUTH_SIGN_UP_ENABLED=false`        | `POST /api/auth/sign-up/*` returns 404 and disappears from `/docs`. **Sign-in, seeding, factories and tests keep working.**                                                      |
| `AUTH_PASSWORD_RESET_ENABLED=false` | `/api/auth/request-password-reset` and `/reset-password*` return 404 and disappear from `/docs`.                                                                                 |

### Why sign-up/reset are gated in the HTTP layer

`src/plugins/auth.ts` filters the path **before** forwarding to `auth.handler(request)`. Better Auth's own `emailAndPassword.disableSignUp` would also disable `auth.api.signUpEmail`, which is exactly what `bun db:seed`, the factories and `actingAs()` call. The switch therefore hides the public endpoint while keeping the server-side capability.

For a sign-up-disabled deployment, users are created by a seeder, an admin (`/api/auth/admin/create-user`, roles on), or your own migration script.

### Auth email

Better Auth's verification and reset emails go through the same queue as feature emails (`MailService.queue`), so a request never waits for the provider. Without `RESEND_API_KEY`, the full message (text and HTML, including the link) is printed to the terminal. Queue, templates and drain triggers: [email.md](email.md).

When a path is disabled, `betterAuthDocs()` removes it from the generated OpenAPI paths, so the docs never advertise an endpoint that returns 404. The same registry hides the admin plugin paths when `AUTH_ROLES_ENABLED=false`: because the plugin is not loaded, both the routes and their docs disappear (and the 404 uses our envelope rather than Better Auth's own body).

## Adding a Better Auth plugin

1. Add a switch in `src/config/env.ts`.
2. Add **one entry** to `authFeatures` in `src/lib/auth-features.ts`:

   ```ts
   twoFactor: {
     enabled: env.AUTH_TWO_FACTOR_ENABLED,
     plugin: () => twoFactor(),   // omit when our own code must keep using the capability
     paths: ['two-factor'],       // omit when not loading the plugin is enough
   },
   ```

   `plugins` and the hidden-path list update themselves.
3. If it needs columns or tables: `bunx @better-auth/cli generate`, add them to `src/db/schema/auth.ts`, then `bun db:generate --name <name>` (run once per dialect).
4. User fields that must stay typed even when the plugin is off belong in `user.additionalFields`. `role` is an example — that is why toggling roles never needs a migration.
5. Mirror the plugin on the frontend (`authClient` plugins). A plugin loaded on one side only produces calls to endpoints that do not exist.
6. Extend `test/fixtures/feature-switches.ts` with the endpoint and docs assertions.

### Why the template does not pre-register every plugin

It is tempting to list all Better Auth plugins and disable them by default. Do not: `enabled` is a **runtime** value, so `plugin: () => twoFactor()` keeps that code in the bundle regardless of the env var. Measured on Better Auth 1.7.25 with this project: importing the whole `better-auth/plugins` barrel adds **≈207 kB gzip** (470 → ≈670 kB), which exceeds the 600 kB budget; the registry costs 0.

There are also non-size costs:

- some plugins ship as **separate packages** (passkey, SSO, …), so a "complete" registry would mean installing dependencies only to disable them;
- each plugin may add **tables/columns** → migrations for all three dialects;
- every plugin widens the `auth.api` type union, slowing `tsc` and muddying errors.

Add an entry when the project actually supports the capability. The catalog below is documentation, not code.

### Plugin catalog (Better Auth 1.7.25)

Common additions; see better-auth.com/docs/plugins for the complete list.

| Plugin                      | Adds                                | Notes                                        |
| --------------------------- | ----------------------------------- | -------------------------------------------- |
| `openAPI`                   | `generateOpenAPISchema()`           | already on; feeds `/docs`, no routes         |
| `admin`                     | roles, permissions, user management | behind `AUTH_ROLES_ENABLED`                  |
| `bearer`                    | `Authorization: Bearer` sessions    | behind `AUTH_BEARER_ENABLED`                 |
| `twoFactor`                 | TOTP/backup codes                   | table `twoFactor`, extra user columns        |
| `organization`              | orgs, members, invitations, teams   | several tables; needs permission wiring      |
| `magicLink`                 | passwordless email links            | needs the mailer                             |
| `emailOTP`                  | one-time codes by email             | needs the mailer                             |
| `username`                  | username sign-in                    | extra user columns                           |
| `phoneNumber`               | SMS OTP                             | needs an SMS provider                        |
| `anonymous`                 | guest sessions                      | `user.isAnonymous`                           |
| `captcha`                   | bot protection on auth routes       | needs a provider (Turnstile/reCAPTCHA)       |
| `jwt`                       | JWKS + JWT sessions                 | table `jwks`                                 |
| `multiSession`              | several accounts per device         | client-side support needed                   |
| `lastLoginMethod`           | track the method used               | extra user column                            |
| `genericOAuth`              | custom OAuth providers              | replaces `socialProviders` for non-built-ins |
| `siwe`                      | Sign-In with Ethereum               |                                              |
| `deviceAuthorization`       | device-code flow (TV/CLI)           |                                              |
| `customSession`             | reshape the session object          |                                              |
| `oauthProxy` / `oauthPopup` | helper/plugin for OAuth flows       | only for specific SSO setups                 |

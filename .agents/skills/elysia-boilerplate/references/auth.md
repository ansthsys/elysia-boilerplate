# Auth: Better Auth, plugins, switches, roles

Part of the `elysia-boilerplate` skill. Load this reference for any auth work; module/controller conventions stay in `SKILL.md`.

## One registry, not env flags per endpoint

`src/lib/auth-features.ts` is the switchboard. Each capability is one entry:

```ts
export const authFeatures = {
	admin: { enabled: env.AUTH_ROLES_ENABLED, plugin: () => admin({ ... }), paths: ['admin'] },
	bearer: { enabled: env.AUTH_BEARER_ENABLED, plugin: () => bearer() },
	signUp: { enabled: env.AUTH_SIGN_UP_ENABLED, paths: ['sign-up'] },
	passwordReset: { enabled: env.AUTH_PASSWORD_RESET_ENABLED, paths: ['request-password-reset', 'reset-password'] },
}
```

- `plugin` is loaded only when enabled; `paths` are hidden (404 + removed from `/docs`) when disabled.
- `authPlugins` and `isAuthPathDisabled` are derived from it. Never append to the array in `src/lib/auth.ts`.
- "Unregister" means editing this file. Do **not** add an env flag for a single endpoint.

## Two ways to turn something off

| Goal | Mechanism | Why |
| --- | --- | --- |
| Capability only exists over HTTP (2FA, organization, magic link) | omit the plugin (or `enabled: false`) | routes and docs disappear automatically; nothing else uses it |
| Our own code still needs the capability (sign-up for seeders, `actingAs`) | keep the plugin, hide `paths` | `auth.api.signUpEmail` keeps working; only the public endpoint 404s |

Never use Better Auth's `disableSignUp`: it also disables `auth.api.signUpEmail`, breaking `db:seed`, factories and every test.

## Adding a plugin

1. Add a switch in `src/config/env.ts` (default **false** for a new plugin).
2. Add one registry entry (import the plugin, provide `plugin` and, if needed, `paths`).
3. Generate tables/columns: `bunx @better-auth/cli generate` → edit `src/db/schema/auth.ts` → `bun db:generate --name <name>` **once per dialect** (switch `src/db/dialect.ts`).
4. Keep user fields typed when the plugin is off: `user.additionalFields` (see `role`).
5. Mirror the plugin in the frontend `authClient`. A one-sided plugin calls endpoints that do not exist.
6. Extend `test/fixtures/feature-switches.ts` and `test/feature-switches.test.ts` (endpoint status + docs presence).
7. Update the switch table in the README and `docs/auth.md`.

Do not pre-register unused plugins: `enabled` is runtime, so the plugin code and its tables ship anyway (measured ≈207 kB gzip for the whole plugin barrel). Add it when the project supports it.

## Guards and permissions

- Macros: `auth: true`, `role: 'admin'`, `permission: { resource: ['action'] }` from `src/plugins/auth.ts`. Modules must `.use(authGuard)`.
- Data-dependent rules (ownership) live in the service with `can()` from `#core/access`.
- New resource: `src/shared/permissions.ts` (`statements` + role grants).
- Roles switched off → `FeatureDisabledError` (403, `FEATURE_DISABLED`), so clients can distinguish it from a plain `FORBIDDEN`.

## Auth email

Verification and reset emails go through `MailService.queue` (not direct sending), so a request never waits for the provider. See [email.md](email.md).

## Finish with

```bash
bun run typecheck && bun run lint && bun test
```

Every auth change needs a test in `test/`; switch behavior belongs in the feature-switch fixture.

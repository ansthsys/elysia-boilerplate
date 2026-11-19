# Upgrading

## Versions

| Package             | Version    |
| ------------------- | ---------- |
| Elysia              | **1.4.32** |
| `@elysiajs/openapi` | 1.4.17     |
| `@elysiajs/eden`    | 1.4.9      |
| Better Auth         | 1.7.25     |
| Drizzle ORM         | 0.45       |
| TypeBox             | 0.34       |

TypeBox is pinned with `overrides` in `package.json`, because Elysia, drizzle-typebox and `src/shared` must share one TypeBox instance.

Dependabot does not propose Elysia major versions; upgrade to Elysia 2 deliberately.

## Upgrading a project from 1.0 to 1.1

The template changed some contracts. Apply them in this order:

1. **Error models.** `errorResponses(...)` now maps each status to its own model and always adds `429`/`500`. Response bodies are unchanged, but regenerated OpenAPI types differ. If a client branches on the envelope, branch on `error.code`: roles switched off now return `FEATURE_DISABLED` (403) instead of `FORBIDDEN`.
2. **New env vars** (all optional with defaults): `AUTH_SIGN_UP_ENABLED`, `AUTH_PASSWORD_RESET_ENABLED`, `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH`, `STORAGE_PUBLIC_BASE_URL`, `STORAGE_SIGNING_SECRET`, `STORAGE_MAX_FILE_SIZE`, `S3_*`. Copy them from `.env.example`.
3. **Migrations.** Regenerate for every dialect you support:

   ```bash
   bun db:generate --name files            # after copying src/db/schema/files.ts
   bun db:generate --name post_published_on
   ```

   Switch `src/db/dialect.ts` between drivers to generate each folder.
4. **Test setup.** `test/setup.ts` now drops and recreates the database. Make sure `NODE_ENV=test` and a disposable `DATABASE_URL` (`*_test`) are set.
5. **Module layout.** Add a `model.ts` to every module that still declares schemas in `index.ts` (the convention test will tell you which ones). Copy `src/modules/health/model.ts` as the smallest example.
6. **Tests to copy** (they encode the new rules): `test/conventions.test.ts`, `test/contracts.test.ts`, `test/openapi.test.ts`, `test/error-contract.test.ts`.
7. **Docker.** The image now runs `dist/`; the migration command is `bun dist/db/migrate.js`. Rebuild the image and update release scripts.
8. **Storage (optional).** Copy `src/lib/storage/` and `src/modules/files/` if the project needs uploads. They are independent of the rest; a project that does not need them can skip the table and migrations.
9. **Mail queue (optional).** Copy `src/modules/mail/`, `src/emails/`, the `mail_outbox` schema and its migration, then:
   - set `CRON_SECRET` and configure a scheduler (GitHub Actions/cron-job.org, or a Pro Vercel cron) that calls the drain endpoint;
   - keep the interval drain in `src/index.ts` for long-running servers;
   - switch `src/lib/auth.ts` from sending directly to `MailService.queue`.
10. **Vercel (optional).** Copy the root `server.ts` entry, remove `"types": ["bun"]` from `tsconfig.json` (Vercel's builder cannot resolve it), and keep `bun run build` as the build command. Ignore `/.vercel/` and `.env.local`.

Files to focus on: `src/shared/response.ts`, `src/shared/errors.ts`, `src/core/http.ts`, `src/plugins/{auth,error-handler,openapi}.ts`, `src/config/env.ts`, `src/db/dialects/*.ts`, `Dockerfile`.

## Routine dependency updates

No tools beyond Bun and git are needed:

1. **Dependabot.** It opens a weekly pull request per group (Elysia, Drizzle, others), and CI runs lint, typecheck and the full test suite on it. Merge when it is green.
2. **By hand.** Run `bun update <package>`, then `bun run typecheck && bun test`.
3. **When `elysia` or `drizzle-typebox` changes version**, check which `@sinclair/typebox` version they need and update both the dependency and `overrides` in `package.json` to that version.

## Upgrading to Elysia 2 with the official codemod

Elysia ships a codemod, [`@elysia/codemod`](https://www.npmjs.com/package/@elysia/codemod), that rewrites 1.4 code to 2.0 syntax. The procedure needs no AI.

```bash
git switch -c upgrade/elysia-2

bunx @elysia/codemod --check        # 1. preview: diffs and warnings, writes nothing
bunx @elysia/codemod                # 2. apply the automatic rewrites
bun install                         # 3. the codemod updated package.json

# 4. do the manual steps below

bun run typecheck && bun run lint && bun test   # 5. the typed tests show what is still broken
```

### What the codemod rewrites in this template

- **Route arguments:** `.get(path, handler, options)` → `.get(path, options, handler)`, in every controller.
- **Auth macros:** the `resolve` key becomes `derive` (`src/plugins/auth.ts`).
- **Hook scopes:** `{ as: 'global' }` becomes the string `'global'` (error handler, request logger).
- **Guards:** `.guard({ params }, …)` gains `schema: 'merge'` (`modules/posts`).
- **Package names:** `@elysiajs/*` imports and `package.json` entries become `@elysia/*`. This includes `@elysiajs/swagger` → `@elysia/openapi`; the template already uses `openapi`.

### Manual steps for this template

These are outside what a codemod can rewrite safely:

1. **TypeBox.** Replace `@sinclair/typebox` 0.34 with `typebox` 1.x and delete the `overrides` entry.
   - `src/config/env.ts` and `src/shared/*.ts` import TypeBox directly.
   - `Static<typeof X>` / `X.static` become `UnwrapSchema<typeof X>` from `elysia`.
2. **drizzle-typebox.** Move to the version that targets TypeBox 1.x (check its release notes), and keep `src/db/typebox.ts` as the single place it is configured.
3. **Rate limiting.** Upgrade `elysia-rate-limit` from 4.x to 5.x, which requires Elysia 2.
4. **`NotFoundError` names.** The codemod renames Elysia's `NotFoundError` to `NotFound`. In `src/plugins/error-handler.ts` it is imported as `NotFoundError as RouteNotFoundError`. The template's own `NotFoundError` (`src/core/errors.ts`) must keep its name, so review that part of the diff.
5. **Update the `elysia-boilerplate` skill.** The codemod only rewrites `.ts` files, not the code blocks inside `.agents/skills/elysia-boilerplate`. Without this step, AI agents keep writing v1 code.
   - In `references/new-feature.md`: swap the verb arguments, add `schema: 'merge'` to guards, and change `['static']` to `UnwrapSchema`.
   - In `SKILL.md`: point to the `elysiajs` skill, delete `elysiajs-v1`, and update the version note.
   - Re-verify by building the recipe's `tasks` feature in a scratch copy, then run `bun run typecheck && bun test`.
6. **Better Auth macros.** Read the Better Auth Elysia integration notes for v2 and confirm `user`/`session` are still typed in handlers. The tests fail to compile if they are not.

Patterns already chosen to keep this list short:

- the error handler dispatches with `instanceof`, not `error.code` (removed in v2);
- there is no `.resolve()` outside macros, no `.mount(instance)`, no `set.redirect` and no `t.Transform`.

## AI agent skills

| Skill                               | Use for                                                      | Managed by                                               |
| ----------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `.agents/skills/elysia-boilerplate` | the template: layers, schemas, database, auth, email, recipe | part of this repository (edit it like code)              |
| `.agents/skills/elysiajs-v1`        | Elysia 1.x; use this one for this repository                 | vendored snapshot (committed, not in `skills-lock.json`) |
| `.agents/skills/elysiajs`           | Elysia 2                                                     | `skills` CLI (`skills-lock.json`)                        |

Template knowledge lives inside the single skill, under `references/`:

| Reference                   | Covers                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `references/new-feature.md` | the step-by-step new-module recipe                              |
| `references/auth.md`        | Better Auth plugins, capability switches, roles and permissions |
| `references/email.md`       | mail queue, templates, drain triggers and email tests           |

All skills are linked for Claude Code (`.claude/skills`), Command Code (`.commandcode/skills`), and OpenCode and other agents that read `.agents/skills`.

### Adding knowledge from your own use cases

Keep one skill for this template; do not create new top-level skill folders for template topics:

- **New module/feature convention** → `references/<topic>.md` in `.agents/skills/elysia-boilerplate` plus a row in its **Specialized references** and **Tasks** tables.
- **Auth topic** (new plugin, provider, permission model) → extend `references/auth.md`.
- **Email topic** (new template, provider, queue behavior) → extend `references/email.md`.
- **Any other template topic** — still `references/<topic>.md` plus a row; the skill description already covers this template.
- **Verify a recipe** by following it in a scratch copy of the repository, then running `bun run typecheck && bun test`. The new-feature recipe was checked this way.

### Keeping them in sync

- **`elysia-boilerplate`**: maintained with the template. When a convention changes, update the skill in the same commit, so AI agents never learn an outdated pattern.

- **`elysiajs` (v2)**: run `npx skills update elysiajs`; the new commit is recorded in `skills-lock.json`. A fresh clone restores it with `npx skills experimental_install`.
- **`elysiajs-v1`**: this is a frozen copy of `elysia/` from [elysiajs/skills@8fd8031](https://github.com/elysiajs/skills/tree/8fd8031/elysia), the last commit before upstream switched to v2. Upstream has no v1 branch or tag and will not update it again. The `skills` CLI can only install from a branch or tag, so the copy is committed instead of being listed in the lock file. `npx skills update` ignores it, and that is intended.
  - The only local change is `name`/`description` in its `SKILL.md`, so it does not clash with the v2 skill.
  - To refresh it by hand:

    ```bash
    git clone https://github.com/elysiajs/skills /tmp/elysia-skills
    git -C /tmp/elysia-skills archive <commit> elysia | tar -x -C /tmp
    rsync -a --delete /tmp/elysia/ .agents/skills/elysiajs-v1/
    ```

    Then restore the `name: elysiajs-v1` frontmatter.
- **When this repository moves to Elysia 2**: delete `.agents/skills/elysiajs-v1` and its two symlinks (`.claude/skills/elysiajs-v1`, `.commandcode/skills/elysiajs-v1`), and use the `elysiajs` skill only.

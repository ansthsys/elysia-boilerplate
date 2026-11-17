# Updating a project created from this template

A project made from this template does not receive template changes automatically. They are pulled in with plain git, using the version tags and [CHANGELOG.md](../CHANGELOG.md). No AI or extra tools are needed.

## One-time setup in your project

```bash
git remote add template https://github.com/<owner>/elysia-boilerplate.git
git fetch template --tags
```

Record which template version you started from, e.g. in your README: `Created from elysia-boilerplate v1.0.0`.

## Pulling in a new template version

1. Read the template's `CHANGELOG.md` for every version since yours. Each entry lists the changed files.
2. See exactly what changed between two versions:

   ```bash
   git fetch template --tags
   git diff v1.0.0 v1.1.0 --stat                  # files touched
   git diff v1.0.0 v1.1.0 -- src/core src/plugins # the actual changes
   ```

3. Apply the changes. Pick one way:

   ```bash
   # A. apply the whole release as a patch; conflicts are left as .rej files to review
   git diff v1.0.0 v1.1.0 -- . ':!src/modules' ':!test' | git apply --3way

   # B. take individual commits
   git log --oneline v1.0.0..v1.1.0
   git cherry-pick <commit>

   # C. copy a single file you never modified
   git checkout v1.1.0 -- src/plugins/security-headers.ts
   ```

4. Check the result: `bun install && bun run typecheck && bun run lint && bun test`.
5. Update the recorded template version.

## Why conflicts stay small

Template fixes almost always land in the infrastructure, which projects rarely edit:

| Usually template-owned (safe to take as is)                                                                                                             | Usually yours (review or skip)                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`, `src/plugins/`, `src/config/`, `src/db/dialects/`, `src/db/migrate.ts`, `src/db/seed.ts`, `src/lib/`, `scripts/`, `.github/`, `Dockerfile` | `src/modules/`, `src/db/schema/`, `src/db/seeders/`, `src/db/factories/`, `src/shared/permissions.ts`, `test/`, `drizzle/` |

The example modules (`categories`, `posts`, `admin`) are meant to be changed or deleted. Template changes to them can usually be skipped.

## Maintaining the template (for the template owner)

1. Make the change with tests, and add an entry under a new version in `CHANGELOG.md`.
2. Commit, then tag the version: `git tag -a v1.1.0 -m "v1.1.0"`.
3. Push the commit and the tag: `git push && git push --tags`.

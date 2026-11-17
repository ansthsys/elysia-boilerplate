# Changelog

All notable changes to this template. Versions follow [Semantic Versioning](https://semver.org):

| Bump      | Meaning                                       |
| --------- | --------------------------------------------- |
| **major** | a change that existing projects must adapt to |
| **minor** | a new feature or example                      |
| **patch** | a fix                                         |

Each entry lists the files that changed, so projects created from the template can apply them. See [docs/updating-from-template.md](docs/updating-from-template.md).

## [1.0.0] - 2026-11-17

First release.

- **Stack:** Elysia 1.4 + Bun REST API with layered modules (controller → service → repository).
- **Auth:** Better Auth with email/password.
  - Optional plugins: admin (roles & permissions) and bearer.
  - Guard macros: `auth`, `role`, `permission`.
- **Responses:** a standard envelope for success and errors, custom error classes, and field-level validation messages.
- **Database:** Drizzle with a one-line switch between PostgreSQL, MySQL and SQLite.
  - Migrations per driver; `db:migrate` offers to create a missing database.
  - Factories and seeders per table.
- **Docs & logging:** OpenAPI + Scalar with Better Auth routes merged in, and pino logs with a request id.
- **Production defaults:** security headers, rate limiting, environment validation, docs off in production, and migrations as a release step.
- **AI agents:** an `elysia-boilerplate` skill with the template's conventions and a verified new-feature recipe, plus Elysia v1/v2 skills, for Claude Code, OpenCode, Command Code and agents that read `.agents/skills`.
- **Quality:** Eden Treaty tests on all three drivers, CI that follows the selected driver, Docker, Dependabot and Biome.

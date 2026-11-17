/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  DATABASE DRIVER SWITCH                                              │
 * │                                                                      │
 * │  Change the line below to './dialects/mysql' or './dialects/sqlite', │
 * │  update DATABASE_URL in .env, then run `bun db:generate` and         │
 * │  `bun db:migrate`. Nothing else needs to change.                      │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Why a code switch instead of an env var? Drizzle query types are specific
 * to each SQL dialect. Picking the dialect here keeps every query fully typed;
 * picking it at runtime would turn `db` into a union nobody can call.
 */
export * from './dialects/postgres'

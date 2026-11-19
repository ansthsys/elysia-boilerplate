# Deployment

## Choose a mode

| Target                    | Best for                   | Database                 | Storage                           | Notes                                  |
| ------------------------- | -------------------------- | ------------------------ | --------------------------------- | -------------------------------------- |
| **Docker / long-running** | most APIs, VPS, Kubernetes | any of the three drivers | `local` + volume, or `s3`         | migrations are a separate release step |
| **Single binary**         | small VPS, on-prem         | any of the three drivers | `local` + mounted volume, or `s3` | ~90 MB binary; same migration rule     |
| **Vercel (Bun runtime)**  | bursty/low traffic APIs    | PostgreSQL or MySQL      | **`s3` only**                     | see the Vercel section below           |

All supported targets run **Bun**, so the same code (including `Bun.S3Client` and `Bun.CryptoHasher`) works everywhere. Cloudflare Workers and other edge runtimes are **not supported**: workerd lacks those Bun APIs and would require D1, R2, Web Crypto and an experimental Elysia adapter.

## Checklist

| Setting                        | Why                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`          | hides 500 messages, secure cookies, disables `/docs` by default, blocks seeders                            |
| `BETTER_AUTH_SECRET`           | 32+ random characters. The app refuses to start without one, or with a value published in this repository. |
| `APP_URL`                      | public HTTPS URL, used in auth callbacks/emails and local signed file URLs                                 |
| `CORS_ORIGINS`                 | exact frontend origins                                                                                     |
| `TRUST_PROXY=true`             | only behind a proxy that sets `X-Forwarded-For`                                                            |
| `STORAGE_DRIVER`               | `local` needs a persistent volume; **Vercel must use `s3`**                                                |
| `S3_*`                         | required when `STORAGE_DRIVER=s3`; the app fails fast otherwise                                            |
| `RESEND_API_KEY`, `EMAIL_FROM` | without them, verification/reset emails are only logged                                                    |
| `OPENAPI_ENABLED=true`         | only if the docs should be public                                                                          |

`.env.production.example` is the starting point.

## Docker

The image is multi-stage: dependencies → `bun run build` → a runtime layer with `dist/`, `drizzle/` and no TypeScript sources.

```bash
docker build -t api .

# once per release, before traffic arrives
docker run --rm --env-file .env.production api bun dist/db/migrate.js --no-create-db

docker run -d --env-file .env.production -p 3000:3000 \
  -v api-storage:/app/storage \        # only for STORAGE_DRIVER=local
  api
```

`docker-compose.yml` shows the same shape with a one-off `migrate` service that must succeed before `api` starts:

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32) docker compose --profile app up -d
```

Migrations are a separate command because several replicas must never migrate concurrently. Write them expand/contract: add columns first, remove them in a later release.

## Single binary

```bash
bun build --compile --minify --target=bun src/index.ts --outfile api
./api
```

- Expect a ~90 MB binary (Bun runtime included). It still needs `drizzle/` next to it for migrations; run them from a build with sources, or ship a second compiled `migrate` binary.
- Mount a volume for `local` storage, exactly like Docker.

## Vercel (Bun runtime)

`src/index.ts` exports the Elysia app as its **default export** and only opens a port when `import.meta.main && !VERCEL`. Vercel imports the module and uses that export as the handler; `vercel.json` pins the runtime:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "bunVersion": "1.x" }
```

Configure in the Vercel project:

| Variable             | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                                                |
| `BETTER_AUTH_SECRET` | generated, 32+ chars                                                                        |
| `APP_URL`            | the public HTTPS URL                                                                        |
| `CORS_ORIGINS`       | the frontend origins                                                                        |
| `TRUST_PROXY`        | `true` (Vercel sets `X-Forwarded-For`; otherwise every client shares one rate-limit bucket) |
| `DATABASE_URL`       | PostgreSQL or MySQL over **TCP** (Neon, RDS, PlanetScale, ...) — **not `bun:sqlite`**       |
| `STORAGE_DRIVER`     | `s3` (functions have no persistent filesystem)                                              |
| `S3_*`               | bucket, region, endpoint and credentials                                                    |
| `CRON_SECRET`        | required by the mail drain endpoint; your scheduler sends it as a Bearer token              |

Notes:

1. **Migrations are a separate job**, never on cold start. Run `bun db:migrate --no-create-db` from CI or a one-off job against the same database.
2. **Rate limiting is per function instance.** Set `TRUST_PROXY=true`; for real protection, move the limit to the edge or a shared store (see "Running more than one instance").
3. **Docs are off by default** in production (`OPENAPI_ENABLED`); enable explicitly if they should be public.
4. **No `bun:sqlite`.** SQLite needs a writable filesystem; use PostgreSQL or MySQL for this target.
5. **Bundle size.** CI builds and checks the gzip budget (`scripts/build-size.ts`); check the platform's function limit before adding dependencies.
6. **Mail is not scheduled by default.** `vercel.json` ships no `crons`, because Hobby allows only daily schedules and previews never run crons. Call `GET /api/internal/mail/drain` from a scheduler (GitHub Actions, cron-job.org, or a Pro Vercel cron) with `Authorization: Bearer $CRON_SECRET`. Requests only enqueue; the drain is a separate invocation, which keeps request time and cost minimal. See [email.md](email.md).

## Cold start and the bundle budget

A serverless invocation has two phases:

1. **Cold start** — the platform boots the runtime, fetches the bundle, parses and evaluates modules, builds the router and creates clients (this template's DB pool connects lazily, on the first query).
2. **Execution** — the request itself.

Both contribute to the time the platform meters; whether initialization is billed depends on the platform and plan. Startup never changes correctness, only latency and cost.

What actually moves it:

- **module evaluation and top-level side effects** — plugin construction, schema generation, logger transports;
- **bundle size** — download and parse;
- **external work at startup** — opening connections, fetching secrets.

This template keeps all three small: importing `src/index.ts` does not open a port, DB clients connect lazily, and Better Auth's OpenAPI generation is skipped when `OPENAPI_ENABLED=false` (the production default). Local measurement on this repo: importing the app takes ≈**120 ms from the built bundle** and ≈**165 ms from sources** — the platform boot dominates.

`bun run build && bun run scripts/build-size.ts` is a **regression guard, not a billing metric**: it fails when `dist/index.js` exceeds `BUNDLE_BUDGET_KB` gzip (600 kB). It catches an accidentally heavy dependency or an import-time side effect before it reaches production. (CI runs both; there is no `build:size` npm script.) To measure startup itself:

```bash
time bun -e "await import('./dist/index.js')"
```

For Docker and conventional servers the budget still matters for image size and memory, but not for per-request billing.

## Running more than one instance

Rate limiting is the only stateful piece:

- **Limit at the edge** (proxy/API gateway). Simplest; optionally set `RATE_LIMIT_ENABLED=false`.
- **Shared store**: pass a Redis-backed `context` to `elysia-rate-limit`, and set Better Auth's `rateLimit.storage` to `'database'` (needs its table) or a `secondaryStorage`.

Storage: use `s3` as soon as more than one instance serves uploads.

## Security headers

`src/plugins/security-headers.ts` sets `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` on every response, plus `Strict-Transport-Security` in production. Serve over HTTPS only.

No Content-Security-Policy is set: the API returns JSON and a strict CSP would break the docs UI. Add a CSP at the proxy if you serve HTML from the same origin.

## Health check

`GET /health` returns 200 when the database answers and 503 otherwise. The image uses it as its `HEALTHCHECK`; point the load balancer at it too.

## Not included

Platform-specific concerns: database backups, log shipping, metrics/alerting, TLS termination, secrets management, autoscaling rules.

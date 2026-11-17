# Deployment

## Checklist

| Setting                        | Why                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`          | hides 500 error messages, enables secure cookies and HSTS, disables `/docs` by default, blocks seeders                                  |
| `BETTER_AUTH_SECRET`           | random, 32+ characters (`openssl rand -base64 32`). The app refuses to start without one, or with a value published in this repository. |
| `APP_URL`                      | the public HTTPS URL of the API (used in auth callbacks and emails)                                                                     |
| `CORS_ORIGINS`                 | the exact frontend origins, comma separated                                                                                             |
| `TRUST_PROXY=true`             | only behind a reverse proxy / load balancer that sets `X-Forwarded-For`; otherwise every client shares the proxy's IP for rate limiting |
| `RESEND_API_KEY`, `EMAIL_FROM` | without them, verification and password reset emails are only logged                                                                    |
| `OPENAPI_ENABLED=true`         | only if the API docs should be public                                                                                                   |

## Migrations are a release step

The Docker image starts the server only. Run migrations once per release, before the new version receives traffic:

```bash
docker run --rm --env-file .env.production <image> bun run src/db/migrate.ts --no-create-db
```

Running them in the container's start command would make several replicas migrate at the same time. `docker-compose.yml` shows the pattern: a one-off `migrate` service that must succeed before `api` starts.

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32) docker compose --profile app up -d
```

Write migrations so the previous version keeps working while the new one rolls out: add columns first, and remove them in a later release.

## Running more than one instance

The app is stateless except for **rate limiting**. Both the API limiter (`src/plugins/rate-limit.ts`) and Better Auth's limiter count requests in memory, so with N instances each client effectively gets N times the limit.

When you scale out, either:

- **Limit at the edge**: reverse proxy, load balancer or API gateway. This is the simplest option. Optionally set `RATE_LIMIT_ENABLED=false` in the app.
- **Use a shared store**:
  - pass a Redis-backed `context` to `elysia-rate-limit`;
  - set Better Auth's `rateLimit.storage` to `'database'` (needs its `rateLimit` table) or to a `secondaryStorage`.

## Security headers

`src/plugins/security-headers.ts` sets `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` on every response. It also sets `Strict-Transport-Security` in production, so serve the API over HTTPS only.

No Content-Security-Policy is set: the API returns JSON, and a strict policy would break the docs UI. If you also serve HTML from the same origin, add a CSP at the proxy.

## Health check

`GET /health` returns 200 when the database answers, and 503 otherwise. The Docker image uses it as its `HEALTHCHECK`; point your load balancer at it too.

## Not included

These depend on your platform: database backups, log shipping, metrics/alerting, TLS termination, and secrets management.

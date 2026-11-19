# Email: queue, templates, drains

Part of the `elysia-boilerplate` skill. Load this reference for anything that sends email.

## The only allowed entry point

```ts
import { MailService } from '#modules/mail/service'

await MailService.queue({ to, subject, text, html })
```

- `queue` inserts into `mail_outbox` and returns; the request never waits for the provider.
- Never import `Resend` or call the provider from a feature. The transport lives in `#lib/mailer` and is used only by the drain.
- Build the message in the **service**, not the controller.

## Templates — `src/emails/`

| Rule | Why |
| --- | --- |
| One file per event (`post-pending-review.ts`) exporting `xxxEmail(data) → { subject, text, html }` | easy to find, easy to test |
| Pure function: no `db`, no Elysia, no logger | renderable in tests and previews |
| `text` is mandatory and contains the action link | console fallback and text-only clients |
| `html` built through `emailLayout`, all user values through `escapeHtml` | consistent shell, no HTML injection |
| Subject built in the template | callers cannot drift |

## Delivery

- States: `pending → sending → sent`, or retry with backoff (10s, 20s, ... capped at 1h), then `failed` after 5 attempts.
- Rows are leased with `lockId`; overlapping drains do not send twice.
- **Docker / conventional server**: interval in `src/index.ts` (10s) + one drain on shutdown.
- **Vercel**: cron in `vercel.json` → `GET /api/internal/mail/drain` with `Authorization: Bearer <CRON_SECRET>`. Without `CRON_SECRET` the route is a 404.

## No provider configured

Without `RESEND_API_KEY` the console transport prints the **whole** message: to, subject, text and HTML. That is how reset/verification links stay usable in development. A provider error logs the same payload, so the link is recoverable.

## Tests

- Inject a transport: `MailService.drain({ transport: async (mail) => ({ delivered: true, via: 'console' }) })`.
- Assert queued rows (`mail_outbox`) for feature behavior; assert delivery/retry in `test/mail.test.ts`.
- `LOG_LEVEL=silent` in tests, so do not assert on captured logs.

## React Email

Do not add React Email by default: measured, its components + render + Tailwind add ≈651 kB gzip to a 473 kB API. If a project needs it, replace template implementations behind the same `{ subject, text, html }` contract, add the JSX config, and raise `BUNDLE_BUDGET_KB` deliberately.

## Finish with

```bash
bun run typecheck && bun run lint && bun test
```

Any new email path needs a test asserting the outbox row (and the template's subject/text/link).

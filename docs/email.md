# Email

Email goes through one path, and requests never wait for the provider:

```
feature service  →  MailService.queue  →  mail_outbox (database)  →  drain  →  Resend | console
```

- `MailService.queue()` only inserts a row. The handler returns immediately.
- A **drain** pass delivers due rows, retries failures with backoff, and marks rows `sent` / `failed`.
- Without `RESEND_API_KEY`, the transport is the **console**: the full message (`text` and `html`) is printed, so reset and verification links stay usable.

## Sending from a feature

```ts
import { MailService } from '#modules/mail/service'
import { postPendingReviewEmail } from '#emails/post-pending-review'

const mail = postPendingReviewEmail({
	postId: post.id,
	title: post.title,
	authorName: post.author.name,
	categoryName: post.category.name,
})

await MailService.queue({ to: admin.email, ...mail })
```

Rules:

1. **Never call Resend directly.** `MailService.queue` is the only entry point for features, so the console fallback and the retry queue keep working.
2. **Build the message in the service**, not in the controller. The controller stays HTTP-only.
3. The insert is awaited (it is fast). Delivery is not: the drain worker does it.

## Templates — `src/emails/`

```
src/emails/
├── layout.ts                 shared HTML shell (inline styles only)
└── post-pending-review.ts    one file per event
```

A template is a **pure function** `(data) => { subject, text, html }`:

- no `db`, no Elysia, no logger;
- **`text` is mandatory** and must contain the action link — it is what the console shows and what text-only clients receive;
- `html` is optional, built through `emailLayout`;
- every interpolated user value goes through `escapeHtml` (imported from `#lib/mailer`);
- the subject is built in the template, not by the caller.

```ts
export function postPendingReviewEmail(data: PostPendingReviewData) {
	return { subject, text, html }
}
```

Add a file per event (`password-changed.ts`, `invoice-ready.ts`, ...). Do not create a generic "email builder" abstraction until there are several shared patterns.

### Why plain TypeScript and not React Email

React Email + Tailwind renders correctly on Bun, but the measured cost for this template's build is high: a probe importing `@react-email/components` + `@react-email/render` + the `Tailwind` component produced **651 kB gzip** on its own, while the whole API is **473 kB**. `@react-email/render` also pulls Prettier, and the Tailwind component compiles CSS at render time. That exceeds the 600 kB budget by a wide margin.

The template layer is a pure function, so switching is contained: replace each `src/emails/*.ts` implementation with a React Email component (`.tsx`), update `tsconfig` (`jsx`), and raise `BUNDLE_BUDGET_KB` deliberately. Do not add React Email "just in case".

## The approval example

`POST /api/posts` by a member queues one review email per admin (`AdminService.adminEmails()`). The post has no `publishedOn` yet; an admin publishes it through the existing `PATCH /api/posts/:id` with a `publishedOn` date, so no separate approval table or endpoint is needed.

The email links to `${APP_URL}/api/posts/<id>`; point that template field at your own admin UI when you build one.

## Delivery model and cost

`MailService.queue()` only inserts a row. The request pays for one small `INSERT` and returns; delivery happens in a **separate drain invocation**.

| Target                           | Drain trigger                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Docker / conventional Bun server | `setInterval` in `src/index.ts` (every 10s), plus one final drain on shutdown                               |
| Vercel / other serverless        | call `GET /api/internal/mail/drain` from a scheduler (GitHub Actions, cron-job.org, a Pro Vercel cron, ...) |

`vercel.json` ships **no `crons` entry**: Hobby accounts reject anything more than once per day, and Vercel crons never run on preview deployments. Scheduling is a deployment decision, not a template default.

Why not inline or `waitUntil`:

- **Inline (`await sendMailNow`)** — the request waits for the provider, like Laravel's `Mail::send()`. Correct, but the invocation (and its cost) grows by the provider round-trip.
- **`waitUntil`** — the response returns earlier, but the function keeps running and is still billed; it can also be cut off. It improves latency, not cost.
- **External drain** — the enqueue request stays minimal, and draining runs as its own invocation that can batch many emails. Cheapest and portable across platforms.

Latency is therefore "until the next drain" (for example, every 5 minutes). That is fine for notifications and usually for password reset. If a flow truly requires instant delivery, call `sendMailNow` explicitly and accept the wait — that is the documented escape hatch, not the default.

Example scheduler (GitHub Actions; minimum 5 minutes, may be delayed):

```yaml
name: mail-drain
on:
  schedule: [{ cron: "*/5 * * * *" }]
  workflow_dispatch:
jobs:
  drain:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS "$API_URL/api/internal/mail/drain" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          API_URL: ${{ secrets.API_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

The endpoint requires `Authorization: Bearer <CRON_SECRET>`; without `CRON_SECRET` it returns 404 (it does not exist). A Vercel cron sends that header automatically when the variable is set. The endpoint is idempotent: rows are leased with a `lockId`, so overlapping drains do not send twice.

## Retries and states

`status`: `pending` → `sending` → `sent`, or `pending` again with backoff, then `failed` after 5 attempts.

- Backoff: 10s, 20s, 40s, ... capped at 1h.
- A crashed worker leaves a lease; the next drain reclaims rows whose `locked_until` expired.
- `last_error` keeps the provider message for debugging.

## Testing

`LOG_LEVEL=silent` is the test default, so assert on behavior, not captured logs:

```ts
const delivered: string[] = []
await MailService.drain({
	transport: async (mail) => {
		delivered.push(mail.subject)
		return { delivered: true, via: 'console' }
	},
})
```

`test/mail.test.ts` covers delivery, retry, the console formatting and the cron endpoint; `test/posts.test.ts` asserts the admin review email is queued.

## Publishing a provider

`RESEND_API_KEY` + `EMAIL_FROM` (a verified domain). Without a key, the console transport is used even in production — set the key there; the console log would otherwise contain reset tokens.

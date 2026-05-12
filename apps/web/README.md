# OpenNext Starter

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

From the **repository root**, run the web and API together (recommended):

```bash
pnpm dev
```

That starts Next on port 3000 and the Fotocorp API Worker on **8787**. Same-origin `/api/auth/*` on the web app proxies to `INTERNAL_API_BASE_URL`; if you only run the web app, `GET /api/auth/get-session` fails with connection refused until the API is listening on that URL.

To run processes separately:

```bash
pnpm dev:web   # Next.js only — configure apps/web/.env.local first
pnpm dev:api   # Worker on http://127.0.0.1:8787 (must match INTERNAL_API_BASE_URL)
pnpm dev:jobs  # Node jobs CLI dry-run (exits after one pass; optional)
```

Quick check that the API is up: `curl -sS http://127.0.0.1:8787/health`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Data Source Configuration

The web app supports repository selection for provisional API integration and local fixture fallback.

Add these variables to `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
INTERNAL_API_BASE_URL=http://127.0.0.1:8787
INTERNAL_API_SECRET=replace-with-long-random-internal-secret
NEXT_PUBLIC_ASSET_DATA_SOURCE=auto
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:5432/database
FOTOCORP_SUPER_ADMIN_EMAIL=admin@example.com
```

- `NEXT_PUBLIC_ASSET_DATA_SOURCE=auto` tries API first and falls back to fixtures when unavailable
- `NEXT_PUBLIC_ASSET_DATA_SOURCE=api` uses API only (shows error states if API is down)
- `NEXT_PUBLIC_ASSET_DATA_SOURCE=fixture` uses local fixture repository only
- `FOTOCORP_SUPER_ADMIN_EMAIL` bootstraps the matching Better Auth user as `SUPER_ADMIN` in Fotocorp's app profile table.
- Better Auth is email/password plus username only. The web `/api/auth/*` route proxies to the API-owned Hono auth handler so browser calls stay same-origin. `BETTER_AUTH_SECRET` and `DATABASE_URL` must match the API Worker’s `.dev.vars` so sessions validate end-to-end.
- If the auth proxy returns `502` with `AUTH_UPSTREAM_UNAVAILABLE`, the Worker is not reachable at `INTERNAL_API_BASE_URL` (wrong port, API not started, or firewall).
- Email verification and password reset mail delivery are intentionally TODO until a production mailer is added.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
npm run preview
# or similar package manager command
```

## Deploy

Deploy the application to Cloudflare:

```bash
npm run deploy
# or similar package manager command
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

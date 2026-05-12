# Staff authentication runbook

## Summary

Internal Fotocorp dashboard access uses **staff** identity: separate username/password accounts in Postgres (`staff_accounts`), session rows in `staff_sessions`, and an HttpOnly browser cookie `fotocorp_staff_session`. This is **not** Better Auth and **not** the contributor (`fc_ph_session`) portal.

Public customers remain on Better Auth. Upload contributors remain on contributor auth.

## Database

Apply migration `0024_staff_auth.sql` (Drizzle journal tag `0024_staff_auth`):

- `staff_accounts` — unique lowercased `username`, scrypt `password_hash`, `role`, `status` (`ACTIVE` | `DISABLED`).
- `staff_sessions` — `session_token_hash` (SHA-256 of raw token), `expires_at`, optional `ip_address` / `user_agent`, `revoked_at`.
- `staff_audit_logs` — foundation only; auth events such as `STAFF_LOGIN_SUCCESS`, `STAFF_LOGIN_FAILED`, `STAFF_LOGOUT`.

Run from `apps/api`:

```bash
pnpm run db:migrate
```

## Bootstrap first staff user

Set in `apps/api/.dev.vars` (do not commit real passwords):

- `STAFF_BOOTSTRAP_USERNAME` — normalized to lowercase in script
- `STAFF_BOOTSTRAP_PASSWORD` — minimum **8** characters
- `STAFF_BOOTSTRAP_DISPLAY_NAME` — optional
- `STAFF_BOOTSTRAP_ROLE` — optional; one of `SUPER_ADMIN`, `CATALOG_MANAGER`, `REVIEWER`, `FINANCE`, `SUPPORT` (defaults to `SUPER_ADMIN`)

Then:

```bash
pnpm --dir apps/api staff:bootstrap
```

The script does not print the password. If the username already exists, it exits without changing the row.

## API (Worker)

Routes (Hono):

- `POST /api/v1/staff/auth/login`
- `POST /api/v1/staff/auth/logout`
- `GET /api/v1/staff/auth/me`

Invalid login returns `401` with `INVALID_CREDENTIALS` and a generic message (no username vs password distinction).

## Web (Next.js)

- Same-origin proxy: `/api/staff/*` → Worker `/api/v1/staff/*`.
- Pages: `/staff/login`, `/staff/dashboard` (placeholder hub).
- `/admin/*` layouts require a staff session (`requireStaff()`); the marketing proxy matcher no longer forces Better Auth on `/admin/*`.

## Internal API actor headers

Server-side calls from `apps/web` to `/api/v1/internal/admin/*` still require `INTERNAL_API_SECRET`. Actor audit headers are now derived from the staff session when present:

- `x-admin-auth-user-id` — staff account UUID
- `x-admin-email` — `staff:<username>` (internal labeling; not a mailbox)

## Manual smoke

1. Migrate DB → bootstrap staff → open `/staff/login` → sign in → confirm cookie `fotocorp_staff_session` in devtools.
2. Open `/staff/dashboard` — should load when staff session is valid (role-aware landing may redirect first).
3. Staff sign out from staff console or header — cookie cleared; protected `/staff/*` routes require login again. Legacy `/admin/*` browser URLs **404** (reserved namespace).
4. Confirm Better Auth customer sign-in still works (`/sign-in`).
5. Confirm contributor portal still works (`/contributor/login`, `fc_ph_session`).

## Follow-ups

- Optional rename of internal API paths from `/api/v1/internal/admin/*` to `/api/v1/internal/staff/*` when safe (web BFF already uses staff terminology where renamed).
- Optional deeper API-layer RBAC mirroring web route maps.
- Staff password change / reset flows (not in PR-16C).

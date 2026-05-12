# Photographer Auth Runbook

Portal authentication is **separate** from Better Auth (Fotocorp app users / subscribers / admins).

## Data model

- **`photographer_accounts`** — username (`ph_*`), `password_hash` (Worker-compatible `$scrypt$`), `must_change_password`, FK to `photographers`.
- **`photographer_sessions`** — opaque session tokens; stored hashes only; tied to accounts.

## Operations

- **Generated credential CSV** — produced by `pnpm --dir apps/api photographers:generate-accounts` (see [photographer accounts report](./reports/photographer-accounts-report.md)). Treat CSV as **secret**; rotate or regenerate per org policy.
- **Password hashing** — scrypt-based; verification uses Worker-safe paths (`@noble/hashes`), not Node-only bcrypt where avoided for Worker parity.

## HTTP / cookie behavior

- **Session cookie** — `fc_ph_session`; not shared with Better Auth cookies.
- **Cookie isolation** — photographer portal middleware must not assume Better Auth session (and vice versa).

## Security boundary

- **Photographer auth does not grant** customer, subscriber, or admin access to main-app routes or internal APIs.

## Routes (API)

- `POST /api/v1/photographer/auth/login`
- `POST /api/v1/photographer/auth/logout`
- `GET /api/v1/photographer/auth/me`
- `POST /api/v1/photographer/auth/change-password`

Browser traffic uses same-origin `/api/photographer/*` proxies in `apps/web`. See [photographer auth boundary report](./reports/photographer-auth-boundary-report.md) and [portal UI report](./reports/photographer-portal-ui-report.md).

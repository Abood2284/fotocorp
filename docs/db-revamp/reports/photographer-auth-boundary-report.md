# PR-09: Photographer portal auth boundary

## Scope

This PR adds the API/session foundation for photographer portal authentication. It does **not** build the web dashboard UI.

## Auth Isolation

Photographer auth is separate from customer/subscriber/admin auth:

- Photographer credentials live in `photographer_accounts`.
- Photographer sessions live in `photographer_sessions`.
- Photographer routes read only the `fc_ph_session` cookie.
- Better Auth customer/admin sessions do not satisfy photographer routes.
- Photographer sessions do not satisfy internal admin/customer/subscriber routes.

No photographer accounts are added to Better Auth tables, `app_user_profiles`, or admin-user flows.

## Password Hash Compatibility

PR-08 generated `$scrypt$` hashes using a Node-only helper under `apps/api/scripts/lib`. Worker route code cannot depend on Node `crypto.scrypt`.

Decision: preserve the existing `$scrypt$n=16384,r=8,p=1$...` hash format and verify it at runtime with `@noble/hashes/scrypt.js`, a JS implementation that can run in Cloudflare Workers. The generator now re-exports the same Worker-compatible helper so future generated hashes stay compatible.

No CSV regeneration was required.

## Cookie and Session

- Cookie: `fc_ph_session`
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` for HTTPS requests
- Session lifetime: 7 days
- Raw session token: 32 random bytes, URL-safe encoded, stored only in the cookie
- Database storage: SHA-256 hash of the token in `photographer_sessions.token_hash`

## Routes

- `POST /api/v1/photographer/auth/login`
- `POST /api/v1/photographer/auth/logout`
- `GET /api/v1/photographer/auth/me`
- `POST /api/v1/photographer/auth/change-password`
- `GET /api/v1/photographer/images`

Login uses generic errors for wrong username, wrong password, and inactive account state. Responses never include `password_hash`.

## Change Password

`change-password` requires a valid photographer session and the current password. New passwords must:

- be at least 12 characters
- include uppercase
- include lowercase
- include a number
- include a symbol

On success, the API stores a new `$scrypt$` password hash, sets `must_change_password = false`, updates `updated_at`, and revokes other active sessions for the same account.

## Protected Image Ownership Route

`GET /api/v1/photographer/images` proves the route boundary by filtering:

```sql
image_assets.photographer_id = current_session.photographer_id
```

It returns paginated safe metadata plus derivative availability, and does not expose R2 storage keys.

## Smoke Test

```bash
pnpm --dir apps/api smoke:photographer-auth
```

Without `PHOTOGRAPHER_SMOKE_USERNAME` and `PHOTOGRAPHER_SMOKE_PASSWORD`, the smoke script skips HTTP login and still prints DB-level counts. With those vars, it runs in-process Hono checks:

1. login
2. `/auth/me`
3. `/photographer/images`
4. logout
5. verifies `/auth/me` fails after logout

Do not print or commit temporary passwords. The credential CSV remains sensitive and single-use.

## Deferred

PR-10 should build the photographer portal web UI: login page, forced password-change screen, dashboard shell, and image list.

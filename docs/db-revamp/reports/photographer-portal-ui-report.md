# PR-10: Photographer portal web UI

## Scope

This PR adds the first web UI for the separate photographer portal. It is intentionally small: login, forced password change, dashboard shell, image list, logout, and a same-origin web API proxy.

## Web Routes

- `/photographer/login`
- `/photographer`
- `/photographer/change-password`
- `/photographer/dashboard`
- `/photographer/images`

`/photographer` redirects to `/photographer/dashboard`.

## Auth Boundary

Photographer auth remains separate from customer/subscriber/admin auth:

- Browser UI uses the API-owned `fc_ph_session` cookie.
- The web app proxies photographer calls through `/api/photographer/*` to API `/api/v1/photographer/*`.
- The photographer portal does not call `/api/v1/internal/*`.
- The portal does not use Better Auth customer/admin session state.
- Passwords are submitted only to login/change-password endpoints and are not persisted in browser storage.

## Must Change Password

- Login redirects photographers with `mustChangePassword = true` to `/photographer/change-password`.
- Protected dashboard/images pages call the photographer `/me` endpoint server-side.
- Dashboard/images redirect to `/photographer/change-password` until the password is changed.
- The shell also has a client-side guard to route any protected photographer page back to change-password when required.

## Image Ownership

The image page uses `GET /api/v1/photographer/images` through the same-origin proxy. API ownership filtering remains server-side:

```sql
image_assets.photographer_id = current_session.photographer_id
```

The UI displays safe metadata only: Fotokey, title/headline, caption snippet, event name/date/location, status, visibility, and derivative availability. It does not expose R2 keys, original URLs, storage URLs, download controls, or admin edit controls.

## Deferred

- Full photographer dashboard analytics
- Image detail/review workflows
- Upload workflow replacement
- Email password reset/delivery
- Advanced reporting

## Manual Test Checklist

Use one row from the generated credential CSV. Do not paste or commit passwords.

1. Visit `/photographer/login`.
2. Login with `ph_000xxx` and the temporary password.
3. Confirm redirect to `/photographer/change-password` if `mustChangePassword` is true.
4. Try opening `/photographer/dashboard` before changing password.
5. Confirm it redirects back to `/photographer/change-password`.
6. Change password successfully.
7. Confirm redirect to `/photographer/dashboard`.
8. Open `/photographer/images`.
9. Confirm only that photographer's images appear.
10. Logout.
11. Confirm `/api/photographer/auth/me` no longer returns an active session.
12. Confirm `/photographer/dashboard` redirects to login after logout.
13. Try wrong credentials and confirm the UI shows a generic `Invalid username or password.` error.

## Set-Cookie propagation (PR-10.1)

Photographer auth handlers must return `c.json(...)` from Hono so `setCookie` headers are merged into the final response. Returning a standalone `Response.json()` from a helper drops those headers, so login could create DB rows without sending `fc_ph_session` to the client.

The web proxy at `/api/photographer/*` re-appends upstream `Set-Cookie` via `Headers#getSetCookie()` when available so Node’s fetch correctly forwards cookies to the browser.

## Verification

Automated verification for this PR:

```bash
pnpm --dir apps/web lint
pnpm --dir apps/web build
pnpm --dir apps/api db:validate:photographer-auth
pnpm --dir apps/api db:validate:photographer-accounts
pnpm --dir apps/api smoke:photographer-auth
pnpm --dir apps/api exec tsc --noEmit
pnpm --dir apps/api check
```

HTTP login smoke requires `PHOTOGRAPHER_SMOKE_USERNAME` and `PHOTOGRAPHER_SMOKE_PASSWORD`.

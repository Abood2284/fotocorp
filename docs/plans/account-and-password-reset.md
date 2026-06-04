# Account profile revamp + password reset

**Design source:** [`design.md`](../../design.md) (not `context/ui-context.md`). Account and auth surfaces use Wired-style tokens already mapped in `apps/web/src/app/globals.css`: square geometry (`rounded-none`), hairline borders (`--border` / `#e0e0e0`), ink-on-canvas typography, `button-primary-square` / outline CTAs, no card drop shadows.

**Auth / email primitives:** Platform `auth_credentials` + `fotocorp_session`; email via `deliverTemplatedEmail` + Resend (`apps/api/src/lib/email/`). Contributor change-password is the reference implementation.

---

## Goals

1. **Account overview** — Show what the signed-in customer can do on Fotocorp (browse, Fotobox, downloads, licensing) in plain language, not raw DB enums.
2. **Authenticated password change** — From account security, with current password (mirror contributor flow).
3. **Forgot password** — From `/sign-in`, email a one-time link, complete reset on a public route.

---

## PR sequence

| PR | Scope | Delivers |
| --- | --- | --- |
| **PR-1** | Account UX | Revamped `/account`, `AccountShell` nav, `/account/security` shell, design.md styling — **done** |
| **PR-2** | Change password (session) | API `POST /api/v1/auth/change-password`, BFF, security form, tests — **done** |
| **PR-3** | Forgot / reset (email) | Migration `password_reset_tokens`, API forgot + reset + validate, email template, web routes, sign-in link — **done** |

Ship and review each PR independently. Do not mix PR-2 API with PR-3 migration in one review.

---

## PR-1 — Account overview (design.md)

### Information architecture

| Section | Eyebrow (Apercu-style) | Content |
| --- | --- | --- |
| Identity | `Your account` | Display name, email |
| Access | `What you can do` | Capability bullets: browse/search, Fotobox, clean downloads if subscriber else request access |
| Tools | `Your workspace` | Story-row links: Fotobox, Downloads, Download access / Request access |
| Security | `Security` | Link to `/account/security` (change password in PR-2) |
| Help | `Need help?` | Request access, Contact |

### design.md application

- Section eyebrows: `text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground` (category-eyebrow analogue).
- Panels: `border border-border bg-background`, **`rounded-none`**, no `shadow-sm`.
- Rows / quick links: `story-row` pattern — hairline `border-b border-border`, hover `bg-secondary/50`.
- Primary CTA: `button-primary-square`; secondary: `border border-border-strong` outline.
- Metadata: `text-muted-foreground` for body (`#757575` token).

### Files (expected)

- `apps/web/src/app/(marketing)/account/page.tsx`
- `apps/web/src/components/account/account-shell.tsx`
- `apps/web/src/app/(marketing)/account/security/page.tsx` (shell)
- Optional: `apps/web/src/components/account/account-section.tsx` if reuse helps

### Out of scope PR-1

- Password API, forgot-password routes, email templates.

---

## PR-2 — Change password (authenticated)

### API (`platform-auth`)

- `POST /api/v1/auth/change-password`
- Auth: valid `fotocorp_session`, `owner_type = USER`
- Body: `{ currentPassword, newPassword }`
- Verify current with `verifyPhotographerPortalPassword`
- Strength: `validatePhotographerPortalPasswordStrength` (minimum 6 characters, same as sign-up)
- Update **both** USER rows (`EMAIL` + `USERNAME`) to same new hash; set `password_updated_at`, `must_reset_password = false`
- Revoke other sessions for credential (same as contributor)

### Web

- BFF: `apps/web/src/app/api/auth/change-password/route.ts` → proxy
- `ChangePlatformPasswordForm` (reuse contributor validation rules)
- Wire `/account/security`

### Tests

- API unit tests: wrong current, weak password, success updates hash
- Web: optional client validation test

---

## PR-3 — Forgot / reset (unauthenticated)

### Database

New table `password_reset_tokens`:

- `id` uuid PK (email `related_entity.id`)
- `user_id` uuid FK → users
- `token_hash` text not null
- `expires_at` timestamptz (e.g. 60 min)
- `used_at` timestamptz null
- `created_at`, optional `requested_ip`

On new request: invalidate prior unused tokens for user (optional).

### API

| Route | Behavior |
| --- | --- |
| `POST /api/v1/auth/forgot-password` | Body `{ email }`; always 200 generic message; rate limit IP+email; send email if USER EMAIL credential ACTIVE |
| `GET /api/v1/auth/reset-password/validate` | Query `token`; 200/400 for UI |
| `POST /api/v1/auth/reset-password` | Body `{ token, newPassword }`; consume token; update both credential hashes; revoke all user sessions |

### Email

- Template key: `CUSTOMER_PASSWORD_RESET`
- CTA: `${PUBLIC_WEB_ORIGIN}/reset-password?token=<raw>`
- `relatedEntity: { type: "password_reset", id: <tokenRowId> }` (per-send idempotency)
- Extend `EMAIL_TEMPLATE_METADATA`, `templates.ts`, `types.ts`, integration docs

### Web routes

| Route | Purpose |
| --- | --- |
| `/forgot-password` | Email form |
| `/reset-password` | New password + confirm |
| `/sign-in` | Link Forgot password → `/forgot-password` |

BFF proxies for all mutating routes. **v1 scope:** platform `USER` only (sign-in `scope=USER`). Staff and contributor recovery are follow-ups.

### Security checklist

- Generic response on forgot (no enumeration)
- Store only `token_hash` (SHA-256 of raw token)
- Single-use, short TTL
- Force sign-in after reset (no auto session)
- HTTPS links via `PUBLIC_WEB_ORIGIN`

---

## Acceptance criteria (full initiative)

- [ ] Account page explains capabilities without exposing `AppRole` / raw status enums
- [ ] Logged-in user can change password with current password verification
- [ ] Forgot flow sends email; link works once; expired link shows clear error
- [ ] After reset, old sessions invalid; user signs in with new password
- [ ] All UI matches `design.md` square + hairline rules on account/auth pages

---

## Follow-ups (post PR-3)

- Contributor forgot password from shared sign-in (if product wants)
- Separate security sender (`noreply@`) vs `subscription@`
- Forced reset when `must_reset_password` is set on USER credentials

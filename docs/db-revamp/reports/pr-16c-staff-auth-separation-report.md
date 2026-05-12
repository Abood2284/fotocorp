# PR-16C — Staff auth separation report

## 1. Files changed (high level)

- `apps/api`: migration `drizzle/0024_staff_auth.sql`, Drizzle schema exports, `honoApp.ts`, new `src/routes/staff/auth/*`, `src/lib/auth/staff-password.ts`, smoke script tweak, `package.json` script, `.dev.vars.example`.
- `apps/web`: staff proxy route, staff API client, staff session helpers, `(staff)/staff/*` pages, admin layout/shell, marketing layout + header, internal admin API header builders, admin asset / contributor BFF guards, `proxy.ts` matcher.
- `context/architecture.md`, `context/progress-tracker.md`, `apps/api/docs/api-routing-audit.md`, this report, `docs/db-revamp/staff-auth-runbook.md`.

## 2. Files added

- `apps/api/drizzle/0024_staff_auth.sql`
- `apps/api/src/db/schema/staff-accounts.ts`
- `apps/api/src/db/schema/staff-sessions.ts`
- `apps/api/src/db/schema/staff-audit-logs.ts`
- `apps/api/src/lib/auth/staff-password.ts`
- `apps/api/src/routes/staff/auth/route.ts`
- `apps/api/src/routes/staff/auth/service.ts`
- `apps/api/src/routes/staff/auth/validators.ts`
- `apps/api/scripts/staff/bootstrap-staff-account.ts`
- `apps/web/src/app/api/staff/[...path]/route.ts`
- `apps/web/src/app/(staff)/layout.tsx`
- `apps/web/src/app/(staff)/staff/login/page.tsx`
- `apps/web/src/app/(staff)/staff/dashboard/page.tsx`
- `apps/web/src/lib/api/staff-api.ts`
- `apps/web/src/lib/staff-session.ts`
- `apps/web/src/components/staff/staff-login-form.tsx`
- `docs/db-revamp/staff-auth-runbook.md`
- `docs/db-revamp/reports/pr-16c-staff-auth-separation-report.md`

## 3. Migrations

- `0024_staff_auth.sql` — creates `staff_accounts`, `staff_sessions`, `staff_audit_logs` (+ indexes, FKs). Journal entry `0024_staff_auth` in `drizzle/meta/_journal.json`.

## 4. Routes / pages

- **New web:** `/staff/login`, `/staff/dashboard`; layout group `(staff)`.
- **Existing web:** all `/admin/*` pages now gated by `requireStaff()` instead of Better Auth `requireAdmin()`.
- **Proxy:** `apps/web/src/proxy.ts` matcher is `/account/:path*` only (admin removed so staff cookie is not blocked by Better Auth redirect).

## 5. API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/staff/auth/login` | Staff login; sets `fotocorp_staff_session` |
| POST | `/api/v1/staff/auth/logout` | Revoke session + clear cookie |
| GET | `/api/v1/staff/auth/me` | Current staff profile |

Web proxy: `/api/staff/*` → same paths on the Worker under `/api/v1/staff/*`.

## 6. Auth / session helpers

- **API:** `hashStaffPassword` / `verifyStaffPassword` / `validateStaffPasswordLength` (`staff-password.ts`, reuses contributor scrypt envelope); session token SHA-256 + cookie handling in `routes/staff/auth/service.ts`; `insertStaffAuditLog` for auth events.
- **Web:** `getOptionalStaffSession`, `requireStaff`, `requireStaffRole`, `getStaffInternalAdminActorHeaders` (`staff-session.ts`); `staff-api.ts` for JSON calls.

## 7. Bootstrap script

- Command: `pnpm --dir apps/api staff:bootstrap`
- Env: `STAFF_BOOTSTRAP_USERNAME`, `STAFF_BOOTSTRAP_PASSWORD` (≥8 chars), optional `STAFF_BOOTSTRAP_DISPLAY_NAME`, optional `STAFF_BOOTSTRAP_ROLE`.
- Idempotent on username; never prints password.

## 8. BetterAuth removed from internal dashboard

- `apps/web/src/app/(admin)/admin/layout.tsx` no longer calls `requireAdmin()` / `requireRole`.
- `admin-catalog-api` / `admin-contributor-uploads-api` actor headers use staff session, not `getCurrentAuthUser()`.
- Marketing header no longer shows internal tools purely from `app_user_profiles.role === ADMIN`; staff tools appear when a staff session exists (`staffBrief`).

## 9. Staff cookie name

`fotocorp_staff_session` (HttpOnly, `SameSite=Lax`, `Secure` when upstream URL is HTTPS, path `/`).

## 10. Commands run

```bash
pnpm --dir apps/api check
pnpm --dir apps/web lint
pnpm --dir apps/web build
pnpm --dir apps/api run smoke:hono-routes
```

## 11. Command results

- `apps/api` TypeScript check: **passed**
- `apps/web` eslint: **passed** (warnings only, pre-existing in other files + `MoreMenu` unused in header)
- `apps/web` build: **passed**
- `smoke:hono-routes`: **passed** (includes `staff auth login wrong method`; `staff auth me` is not in the harness because the smoke `env` omits `DATABASE_URL` and the handler touches the DB)

## 12. Manual test checklist

| Check | Result |
| --- | --- |
| Staff bootstrap | **Not run** in CI (needs real `DATABASE_URL` + env); script + migration are in repo |
| `/staff/login` loads | **Expected OK** (build lists route) |
| Wrong password | **Expected** generic `INVALID_CREDENTIALS` / UI copy |
| Staff cookie set | **Expected** after successful login against live API |
| `/admin` after login | **Expected** with staff session |
| Logout clears session | **Expected** via `/api/staff/auth/logout` |
| Better Auth customer | **Unchanged by design** |
| Contributor portal | **Unchanged by design** |

## 13. Known limitations

- `app_user_profiles` may still contain `ADMIN` / `SUPER_ADMIN` values; they are **ignored** for `/admin/*` access.
- RBAC is stored on `staff_accounts.role` and `requireStaffRole` exists, but most routes currently require **any** active staff session (fine-grained enforcement is a follow-up).
- Hono smoke does not assert `GET /api/v1/staff/auth/me` without a DB binding.
- `/admin` URL namespace retained; `/staff/*` adds login + dashboard hub only.

## 14. Follow-up PRs

- Optional full URL rename from `/admin/*` to `/staff/*`.
- Staff password rotation / admin UI for staff users.
- Expand `staff_audit_logs` consumers beyond auth events.
- Align legacy `architecture.md` contributor vs photographer wording where still historical.

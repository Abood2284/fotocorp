# PR-16D.1 — Staff route namespace, RBAC, and admin UI removal

## Summary

Internal ERP-style tooling now lives under **`/staff/*`**. Legacy **`/admin/*` Next.js pages were deleted**; the **`/admin/*` URL prefix** is reserved and resolves to **404** via `app/admin/[[...path]]/page.tsx` → `notFound()`.

## Routes

| Area | Path |
|------|------|
| Staff login | `/staff/login` |
| Dashboard | `/staff/dashboard` |
| Contributor upload review | `/staff/contributor-uploads`, `/staff/contributor-uploads/batches/[batchId]` |
| Caption placeholder | `/staff/caption-management` |
| Access denied | `/staff/forbidden` |
| Staff users placeholder | `/staff/staff-users` |

## RBAC

- **Navigation**: `apps/web/src/lib/staff/staff-navigation.ts` — `staffNavItemsForRole(role)`.
- **Server guards**: `apps/web/src/lib/staff-session.ts` — `assertStaffRouteAccess(role)` using `staffRoleCanAccessPath` from `apps/web/src/lib/staff/staff-route-access.ts`.
- **Pathname header**: `apps/web/src/proxy.ts` sets **`x-pathname`** for **`/staff/:path*`** (Next.js 16 uses **proxy** instead of `middleware.ts`; middleware was merged here).

Default post-login landing: **`getDefaultStaffLandingPath`** / **`resolveStaffPostLoginRedirect`** in `staff-route-access.ts`.

## API / BFF

- Browser approve action: **`POST /api/staff/contributor-uploads/approve`** (`apps/web/src/app/api/staff/contributor-uploads/approve/route.ts`). Role check: contributor-upload roles only.
- Server-only fetch to Worker: **`apps/web/src/lib/api/staff-contributor-uploads-api.ts`** → internal **`/api/v1/internal/admin/contributor-uploads/*`** (unchanged backend paths; rename to `/internal/staff/*` is follow-up).

## Database

`CAPTION_MANAGER` on `staff_accounts.role`: migration **`0025_staff_role_caption_manager.sql`** (when applied in target environments).

## Verification

- `pnpm --dir apps/web lint` (warnings only, pre-existing in touched/unrelated files).
- `pnpm --dir apps/web build` — pass.
- `pnpm --dir apps/api check` — pass.
- `pnpm --dir apps/api run smoke:hono-routes` — pass.

## Known limitations / follow-up

- Hono internal routes still use **`/api/v1/internal/admin/*`** naming for catalog and contributor-upload pipelines.
- Full **API-layer** RBAC for internal admin routes is optional follow-up; web + BFF enforce staff session and contributor-upload role on approve.

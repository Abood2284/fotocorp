# Fotocorp Code Standards

## General Rules

- Keep changes scoped to one PR/unit at a time.
- Separate architecture refactors, feature behavior, and UI polish unless the work is explicitly scoped to combine them.
- Prefer existing repository patterns, route helpers, DTO shapes, and component conventions.
- Do not introduce fake/demo data paths unless the route is explicitly fixture-backed and documented as such.
- Keep browser-visible output free of private storage and internal API details.

## TypeScript Rules

- Prefer explicit types at route, service, repository, API-client, and component prop boundaries.
- Validate all external inputs: URL params, query strings, JSON bodies, headers, env values, webhook/input files, and import payloads.
- Avoid `any` unless there is a narrow, documented reason. Prefer `unknown` plus validation.
- Keep route response shapes stable. When response contracts must change, update callers and docs in the same scoped PR.
- Use user-safe error codes and messages. Do not expose raw database, R2, or auth errors to clients.
- Keep nullable legacy fields explicit. Legacy metadata can be incomplete, duplicated, or malformed.

## API Rules

- Hono route modules are preferred for new API work.
- Do not add new manual route blocks to `apps/api/src/index.ts` unless explicitly required for transitional compatibility.
- Migrate existing manual routes one route group at a time.
- New internal API routes require internal secret protection and centralized validation.
- Public routes must return safe fields only. Never include storage keys, bucket names, private paths, signed URLs, internal route URLs, or secrets.
- Use cursor pagination for catalog and account list routes. Keep limit caps explicit.
- Do not expose raw DB errors, stack traces, or upstream R2 errors to API consumers.
- Log safe diagnostic info only: route group, method, status, safe error code, sanitized ids, and lengths where useful.
- Keep method guards consistent and close to route registration.
- Decode and validate route params before passing them into business logic.
- Public catalog eligibility should require approved/public/image asset state and ready watermarked derivatives.

## Web and BFF Rules

- `apps/web/src/app/api/*` may act as same-origin BFF routes for browser clients.
- Browser/client components must call same-origin web routes for privileged operations, not internal `apps/api` routes.
- Server-only internal API helpers must live under a clearly server-only path and include `import "server-only"`.
- Privileged server helpers must use `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET`.
- Do not use `NEXT_PUBLIC_API_BASE_URL` as fallback for privileged internal calls.
- Use `apps/web/src/lib/server/internal-api` for privileged web-to-api calls. It owns base URL parsing, secret headers, internal route builders, JSON fetch, stream fetch, and safe internal error parsing.
- Keep `/api/v1/internal/...` route strings centralized in `apps/web/src/lib/server/internal-api/routes.ts`.
- `INTERNAL_API_SECRET` and `x-internal-api-secret` should appear only in server-only internal API client code.
- Public catalog client code may use public API base configuration only for public-safe endpoints.
- Same-origin download preflight routes should return JSON errors; attachment routes may use navigation/iframe flows for downloads.
- Keep auth/session lookup in web route handlers before calling internal APIs.
- Internal `/admin/*` surfaces require a **staff session** (`fotocorp_staff_session` via `apps/web/src/lib/staff-session.ts`); privileged internal admin API calls should send actor headers from `getStaffInternalAdminActorHeaders()`. Better Auth `ADMIN` / `SUPER_ADMIN` roles must not be used as the gate for internal dashboard access.

## Media Rules

- Public preview URLs must go through API preview routes and must resolve to watermarked derivatives.
- Admin original access must go through same-origin admin tunnels and internal API checks.
- Subscriber downloads must go through same-origin download tunnels and internal API checks.
- Do not fetch large originals into browser JavaScript memory as blobs.
- Use anchor/iframe navigation for attachment downloads after server-side preflight when needed.
- Do not expose R2 object keys, bucket names, signed URLs, direct R2 URLs, or private storage paths in HTML, JSON, logs shown to users, query strings, or client-side state.
- Derivative generation should be reproducible, idempotent where possible, and logged with safe summaries.
- Treat originals as canonical. Do not rename, move, or reorganize legacy originals unless mapping safety is proven.

## Database and Migration Rules

- Schema changes require Drizzle schema updates and migration updates.
- Real DB types must be verified before adding FKs or changing references. `app_user_profiles.id` is known to be text in the real DB and must be handled carefully.
- Manual migration patches are discouraged. If unavoidable, document the reason, exact SQL, and follow-up to restore reproducibility.
- Import/mapping scripts must be reproducible, resumable where practical, and logged with import batch/issue records.
- Preserve legacy payloads and identifiers needed for reconciliation.
- Avoid destructive migrations without backup/restore planning.
- Use explicit indexes for high-volume catalog, search/filter, Fotobox, download history, and admin workflows.

## UI Rules

- Public asset cards stay image-first and clean.
- Metadata density belongs mainly on asset detail pages, admin pages, and account history, not on search/home grids.
- Hover actions are allowed, but primary actions must remain usable on touch devices.
- Mobile search/filter UI must avoid cramped filter jungles; prefer compact controls, drawers, or collapsible filter sections.
- Empty, loading, and error states must be polished and safe. Do not show raw JSON or internal error text to users.
- Non-subscribers should see clear upgrade/access messaging instead of broken or misleading download controls.
- Subscriber actions should show entitlement state and actionable failure messages where possible.
- Admin UI can be denser than public UI, but should remain scannable and operational.

## File Organization

- `apps/api/src/routes` contains route handlers. New Hono groups should stay modular by route area.
- `apps/api/src/lib` contains lower-level API utilities, DTOs, media helpers, R2 helpers, internal auth, and asset query helpers.
- `apps/api/src/services` contains service/repository abstractions where still used.
- `apps/api/src/db/schema` contains Drizzle schema definitions.
- `apps/web/src/app` contains Next.js routes, layouts, and route handlers.
- `apps/web/src/components` contains reusable UI components grouped by product area.
- `apps/web/src/lib/api` contains web-side API clients. Privileged clients must be server-only.
- `apps/web/src/features` contains domain types, repositories, and feature-specific helpers.
- `context` contains the working source of truth for future AI-assisted development.

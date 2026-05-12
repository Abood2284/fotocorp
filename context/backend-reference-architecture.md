# Fotocorp Backend Reference Architecture

## Purpose

This document defines Fotocorp's target backend application architecture. It adapts the reference backend pattern to Fotocorp's media security and BFF constraints without rewriting the system in a single step.

## Target Backend Lifecycle

For JSON API routes, use this request lifecycle:

1. Composition root route mount in `apps/api/src/honoApp.ts`
2. Request context middleware (request id, request metadata, request-scoped db access)
3. Auth or internal-auth middleware (based on route trust boundary)
4. Route-entry validation for params/query/body
5. Thin route handler delegating to domain service
6. Service-layer business logic and persistence/storage operations
7. Audit/event emission for mutations and sensitive operations
8. Normalized success/error response envelope with request metadata

Streaming/file routes follow the same trust and validation rules, but may return native stream/attachment responses instead of JSON envelopes.

## Composition Root Rules

- `apps/api/src/index.ts` remains a thin Worker fetch delegator.
- `apps/api/src/honoApp.ts` owns global middleware, route module mounting, `onError`, and `notFound`.
- Shared middleware must be mounted once and reused across route modules.

## Domain Module Structure

Route areas should migrate to domain modules:

```txt
apps/api/src/modules/<domain>/
  route.ts
  service.ts
  validators.ts
  dto.ts (optional)
```

Preferred migration sequence:

1. `modules/fotobox`
2. `modules/downloads`
3. `modules/public-catalog`
4. `modules/media-preview`
5. `modules/admin-catalog`

## Validation Standard

- Standardize on Hono route-entry validation with shared Zod schemas.
- Keep validation close to route entry.
- Services should assume validated inputs and focus on business behavior.
- Return user-safe error codes/messages only.

## Response and Error Standard

JSON routes should converge on a shared shape:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "..."
  }
}
```

And error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SOME_SAFE_CODE",
    "message": "Safe message"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Legacy `ok` payloads are transitional and should be migrated incrementally.

## Internal API and BFF Boundary

- Browser and client components must call same-origin routes in `apps/web/src/app/api`.
- Server-only web code calls internal API using `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET`.
- Privileged internal web calls must never fall back to `NEXT_PUBLIC_API_BASE_URL`.
- Public catalog/media endpoints can stay public-safe and do not need forced BFF indirection.

## Fotocorp-Specific Invariants (Non-Negotiable)

1. Never expose R2 object keys, bucket names, direct R2 URLs, signed URLs, private paths, or internal secrets in browser-visible output.
2. Subscriber access is entitlement-based and must not be modeled as a role.
3. Clean original downloads must always revalidate auth, entitlement, quota, asset eligibility, and source availability server-side.
4. Fotokey/ImageCode remains preserved and business-visible.
5. Legacy original storage mapping must remain stable unless migration safety is proven.

## Runtime QA Requirement

Architecture work is not complete without runtime verification. At minimum:

- Run route smoke harness for fast dispatch checks.
- Run live API/web runtime checks for auth/download/media/catalog flows.
- Validate subscriber download E2E with a real active subscriber and DB log confirmation before claiming completion.

## Delivery Strategy

- Keep changes small and reviewable.
- Do not combine broad architecture refactor with unrelated feature/UI work.
- Update `context/progress-tracker.md` after meaningful implementation changes.
- Update `context/architecture.md` and `apps/api/docs/api-routing-audit.md` when route ownership/behavior changes.

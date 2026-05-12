# AI Workflow Rules

## Required Reading

Before implementing code or making architectural decisions, read these files in order:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`

Also read `apps/api/docs/api-routing-audit.md` before API route work.

## Scope Discipline

- Work one PR/unit at a time.
- Do not mix architecture refactor, feature work, and UI polish unless the user explicitly scopes them together.
- Prefer small, safe PRs with focused verification.
- No big-bang Hono migration.
- If a task crosses multiple route groups, split it or document why it cannot be split.
- Do not rewrite application code during docs/context PRs unless the user explicitly asks or a tiny docs-link cleanup is required.

## Product Accuracy

- Do not invent fake features.
- Do not claim incomplete features are done.
- Separate current implementation from target architecture.
- Mark planned, partial, fixture-backed, and legacy behavior clearly.
- No silent fallback to fake data unless a route explicitly says fixture/demo.
- If a route is legacy or fixture-backed, mark it as such in docs and comments where relevant.

## API and Security Rules

- Do not assume internal routes are browser-safe.
- Browser/client components must never call `/api/v1/internal/...` directly.
- Do not use public env vars for internal server calls.
- Privileged server calls must use `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET`.
- Do not expose R2 keys, bucket names, direct R2 URLs, signed URLs, internal secrets, private storage paths, or raw storage errors.
- If a bug touches auth, downloads, or storage, diagnose the complete flow first before patching.
- Subscriber is an entitlement, not a role.
- Clean original downloads must revalidate auth, subscription, quota, asset eligibility, and source availability server-side.

## Architecture Rules

- Hono route modules are the target for API work.
- Migrate Hono incrementally by route group.
- Do not add new manual router blocks to `apps/api/src/index.ts` unless explicitly needed for transitional compatibility.
- Centralize internal API auth and web internal API route construction.
- Do not rename or move legacy originals without proven mapping safety.
- Fotokey/ImageCode is a business identifier and must remain preserved/displayable/searchable.

## Stale Context

- Ask for or inspect latest file contents before editing when context may be stale.
- If implementation changes architecture, scope, storage, route ownership, or code standards, update the relevant context file before continuing.
- Update `context/progress-tracker.md` after each meaningful implementation change.
- API route changes must update `context/architecture.md` and `apps/api/docs/api-routing-audit.md` when route ownership or behavior changes.

## Verification

- Run the most focused available static checks/tests for the touched area.
- If runtime QA cannot be performed, say exactly why and what was statically verified.
- For download/auth/storage bugs, prefer flow-level verification: browser route, web server helper, internal API route, entitlement logic, R2 access, and user-facing error handling.
- Do not report subscriber downloads as fully working unless runtime QA confirms the actual path.
- Do not report semantic search, payments, photographer workflows, or caption writer workflows as implemented unless code and runtime checks prove it.

## Delivery Notes

- Keep final reports concrete: files changed, behavior documented, verification run, assumptions, and next steps.
- Do not leak secrets or private object identifiers in summaries, logs copied into docs, screenshots, or examples.
- If blocked, document the blocker and the safest next diagnostic step rather than guessing.

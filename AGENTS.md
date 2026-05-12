## Application Building Context

Before implementing code or making architectural decisions in this repository, read these files in order:

1. `context/project-overview.md` — Fotocorp product definition, users, goals, current implementation, scope, and risks.
2. `context/architecture.md` — system boundaries, current and target API architecture, storage model, auth/access model, database ownership, and invariants.
3. `context/ui-context.md` — visual direction, typography, layout rules, components, copy style, and UX invariants.
4. `context/code-standards.md` — TypeScript, API, web/BFF, media, DB/migration, UI, and file organization rules.
5. `context/ai-workflow-rules.md` — Codex workflow, scoping, security, architecture, and verification rules.
6. `context/progress-tracker.md` — current phase, current goal, completed work, in-progress items, known bugs, and next PR sequence.

For API route work, also read:

- `apps/api/docs/api-routing-audit.md`

## Required Maintenance

- Update `context/progress-tracker.md` after each meaningful implementation change.
- If implementation changes architecture, route ownership, storage behavior, auth/access rules, or code conventions, update the relevant context file before continuing.
- If API route ownership or behavior changes, update `context/architecture.md` and `apps/api/docs/api-routing-audit.md`.

## Scope Rules

- Do not proceed with broad refactors without a scoped PR/spec.
- Do not mix architecture refactor, feature work, and UI polish unless explicitly scoped.
- Keep Hono migration incremental by route group.
- Do not add new manual API router blocks unless transitional compatibility explicitly requires it.
- Do not expose R2 object keys, bucket names, direct R2 URLs, signed storage URLs, private storage paths, or internal API secrets to browser-visible output.
- Browser/client components must call same-origin web routes for privileged operations, not `/api/v1/internal/...` routes.

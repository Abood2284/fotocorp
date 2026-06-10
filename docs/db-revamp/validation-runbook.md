# Validation Runbook

One place for database validation scripts (`apps/api`). These scripts assume appropriate `DATABASE_URL` / Worker env for the target Neon branch.

## Core catalog

```bash
pnpm --dir apps/api db:validate:photographers
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:image-derivatives
```

`db:validate:clean-sync` was retired with the legacy import mirror tables. Do not run it against production after legacy table retirement; use the explicit validation queries in [Legacy table retirement runbook](./legacy-table-retirement-runbook.md) for that migration.

## Photographer + admin + publish

```bash
pnpm --dir apps/api db:validate:photographer-auth
pnpm --dir apps/api db:validate:photographer-accounts
pnpm --dir apps/api db:validate:photographer-uploads
pnpm --dir apps/api db:validate:admin-photographer-upload-review
pnpm --dir apps/api db:validate:fotokey-publish
```

## Additional validators (same package)

| Script | Command |
| --- | --- |
| Image log normalization | `pnpm --dir apps/api db:validate:image-logs` |
| Photographer analytics | `pnpm --dir apps/api db:validate:photographer-analytics` |
| Photographer events | `pnpm --dir apps/api db:validate:photographer-events` |

## When to run

- After **migration** on a branch.
- After **photographer upload** flow changes (API, DB, or R2 staging).
- After **admin approval** or **Fotokey / publish pipeline** changes.

Smoke scripts (`smoke:*` in `apps/api/package.json`) complement these checks; see `apps/api/docs/runtime-smoke-tests.md`.

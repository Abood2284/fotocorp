# Import / Clean Sync Runbook (Archived)

This runbook documents the historical legacy import/sync flow. It is retained for audit context only. After legacy table retirement, the production schema no longer supports re-running `legacy:import`, `legacy:import:chunks`, `legacy:sync-clean-schema`, or `db:validate:clean-sync`.

For the production cleanup procedure, use [Legacy Table Retirement Runbook](./legacy-table-retirement-runbook.md).

Historically, legacy CSV and chunk import scripts wrote **old** catalog tables first (`photographer_profiles`, `asset_events`, `assets`, `asset_media_derivatives`, etc.). Clean runtime tables were populated and refreshed by a separate sync step.

## Behavior (summary)

- **Legacy import** writes old tables first.
- **Clean sync** upserts clean tables from legacy sources (`legacy:sync-clean-schema`).
- **Chunked import** auto-invokes sync after successful completed runs (unless disabled).
- **Single-shot import** may require **manual** sync if auto-sync does not run.
- **Batch-scoped sync** may be deferred in some tooling paths; operators rely on **full** sync when reconciling entire imports. See [clean schema import/sync report](./reports/clean-schema-import-sync-report.md) for PR-level detail.

## Historical commands

```bash
pnpm --dir apps/api legacy:sync-clean-schema
pnpm --dir apps/api db:validate:clean-sync
```

These package commands have been removed from the active production command surface. Do not restore or run them against production without a new schema/import design.

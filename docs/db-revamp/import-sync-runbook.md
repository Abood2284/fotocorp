# Import / Clean Sync Runbook

Legacy CSV and chunk import scripts write **old** catalog tables first (`photographer_profiles`, `asset_events`, `assets`, `asset_media_derivatives`, etc.). Clean runtime tables are populated and refreshed by a separate sync step.

## Behavior (summary)

- **Legacy import** writes old tables first.
- **Clean sync** upserts clean tables from legacy sources (`legacy:sync-clean-schema`).
- **Chunked import** auto-invokes sync after successful completed runs (unless disabled).
- **Single-shot import** may require **manual** sync if auto-sync does not run.
- **Batch-scoped sync** may be deferred in some tooling paths; operators rely on **full** sync when reconciling entire imports. See [clean schema import/sync report](./reports/clean-schema-import-sync-report.md) for PR-level detail.

## Commands

```bash
pnpm --dir apps/api legacy:sync-clean-schema
pnpm --dir apps/api db:validate:clean-sync
```

Chunked runner flags (when using `legacy:import:chunks`): `--no-sync-clean-schema`, `--sync-even-if-issues` — documented in the report above and import script `--help` output.

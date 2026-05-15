# Fotocorp DB Revamp Documentation

Entry point for the database revamp: clean catalog tables, photographer flows, import/sync, and related validation.

## Current clean-schema status

| Area | Status |
| --- | --- |
| Photographers | Clean `photographers` keyed by numeric legacy id; runtime joins use `image_assets.photographer_id → photographers.id`. |
| Photo events | Clean `photo_events`; portal CRUD writes here with provenance columns. |
| Image assets | Clean `image_assets`; public catalog and admin catalog use clean reads/writes. |
| Image derivatives | Clean `image_derivatives`; uppercase variants (`THUMB`, `CARD`, `DETAIL`). |
| Access / download logs | Runtime writes target `image_access_logs` and `image_download_logs`. Legacy log tables are not the write target. |
| Photographer accounts / sessions | `photographer_accounts` + `photographer_sessions`; portal auth isolated from Better Auth. |
| Photographer uploads | `photographer_upload_batches` / `photographer_upload_items`; staging R2; `image_assets` rows `SUBMITTED` + `PRIVATE` + `FOTOCORP` until approval pipeline advances them. |
| Admin review queue | Internal admin photographer-upload routes list/review/approve; approval allocates Fotokey and queues publish jobs. |
| Fotokey / publish pipeline | Implemented: Fotokey on admin approval, staging → canonical copy, `image_publish_jobs` / `image_publish_job_items`, processor promotes to `ACTIVE` + `PUBLIC` when derivatives are `READY`. See [Fotokey / publish pipeline](./fotokey-publish-pipeline.md) and [detailed report](./reports/fotokey-publish-pipeline-report.md). |
| Image runtime (Sharp in Worker) | **Investigation pending.** Sharp native modules do not load in the Cloudflare Worker. See [Image processing runtime notes](./image-processing-runtime-notes.md). |

## Canonical docs

| Document | Purpose | When to use |
| --- | --- | --- |
| [README](./README.md) (this file) | Orientation, invariants, doc rules | First stop for DB revamp context |
| [Legacy → clean schema map](./legacy-to-clean-schema-map.md) | Old vs new table/field mapping | Import debugging, migrations, data reasoning |
| [Validation runbook](./validation-runbook.md) | `pnpm --dir apps/api db:validate:*` commands | After migrations, import, sync, upload, or publish changes |
| [Import / clean sync runbook](./import-sync-runbook.md) | Legacy import + `legacy:sync-clean-schema` | After CSV/chunk imports or when clean tables drift |
| [Photographer auth runbook](./photographer-auth-runbook.md) | Accounts, sessions, portal auth boundary | Auth/session work, credential CSV handling |
| [Staff auth runbook](./staff-auth-runbook.md) | Staff accounts/sessions, internal dashboard cookie, bootstrap | Internal `/admin` access, staff login/logout |
| [Photographer upload runbook](./photographer-upload-runbook.md) | Events, batches, staging, submit semantics | Upload API/UI or staging bucket work |
| [Fotokey / publish pipeline](./fotokey-publish-pipeline.md) | Fotokey rules, R2 buckets, go-live gating | Approval queue, publish jobs, derivatives |
| [Media pipeline operations (temporary)](./media-pipeline-operations.md) | One-time derivative migration status + generation commands | Production cutover prep and derivative backlog burn-down |
| [Jobs direct VPS (Docker)](./jobs-direct-vps-deployment-runbook.md) | Private `apps/jobs` worker on a VPS | Raff / bare-metal Docker Compose without CapRover or public HTTP |

## Historical PR reports

Detailed PR write-ups live under [`reports/`](./reports/). They are kept for audit and implementation history; prefer the **Canonical docs** above for day-to-day operations.

| Report | Topic |
| --- | --- |
| [photographer-normalization-report.md](./reports/photographer-normalization-report.md) | PR-01 photographers table |
| [image-asset-normalization-report.md](./reports/image-asset-normalization-report.md) | PR-02 image_assets |
| [image-derivative-normalization-report.md](./reports/image-derivative-normalization-report.md) | PR-03 image_derivatives |
| [image-log-normalization-report.md](./reports/image-log-normalization-report.md) | PR-04 clean logs |
| [runtime-clean-schema-switch-report.md](./reports/runtime-clean-schema-switch-report.md) | PR-05 runtime switch to clean tables |
| [admin-clean-schema-switch-report.md](./reports/admin-clean-schema-switch-report.md) | PR-06 admin clean schema |
| [clean-schema-import-sync-report.md](./reports/clean-schema-import-sync-report.md) | PR-07 sync pipeline |
| [photographer-accounts-report.md](./reports/photographer-accounts-report.md) | PR-08 accounts |
| [photographer-auth-boundary-report.md](./reports/photographer-auth-boundary-report.md) | PR-09 portal auth |
| [photographer-portal-ui-report.md](./reports/photographer-portal-ui-report.md) | PR-10 portal UI |
| [photographer-analytics-report.md](./reports/photographer-analytics-report.md) | PR-11 analytics |
| [download-completion-logging-report.md](./reports/download-completion-logging-report.md) | PR-11.1 download log `COMPLETED` |
| [photographer-events-report.md](./reports/photographer-events-report.md) | PR-12 events API/UI |
| [photographer-bulk-upload-backend-report.md](./reports/photographer-bulk-upload-backend-report.md) | PR-13 upload backend |
| [photographer-bulk-upload-ui-report.md](./reports/photographer-bulk-upload-ui-report.md) | PR-14 upload UI |
| [admin-photographer-upload-review-report.md](./reports/admin-photographer-upload-review-report.md) | PR-15 admin queue |
| [fotokey-publish-pipeline-report.md](./reports/fotokey-publish-pipeline-report.md) | PR-15.1 Fotokey + publish |
| [pr-16i-asset-category-canonicalization-report.md](./reports/pr-16i-asset-category-canonicalization-report.md) | PR-16I public Fotokey + category model |
| [pr-16e-jobs-docker-vps-deployment-report.md](./reports/pr-16e-jobs-docker-vps-deployment-report.md) | PR-16E jobs Docker + VPS |

> **Note:** `image-runtime-compatibility-spike-report.md` and `image-runtime-fallback-spike-report.md` are reserved names for future spikes if checked in; they are not present in the repo today.

## Current lifecycle summary

**Legacy import**

```txt
legacy tables (import scripts) → legacy:sync-clean-schema → clean runtime tables
```

**Photographer upload**

```txt
photographer staging bucket → submitted image_asset (PRIVATE, no Fotokey) → admin review
```

**Admin approval**

```txt
Fotokey assignment → copy canonical original to originals bucket → image_publish_jobs queue
```

**Publish**

```txt
derivatives generated (THUMB, CARD, DETAIL) → image becomes ACTIVE + PUBLIC
```

## Important invariants

- `image_assets.source = FOTOCORP` for photographer-uploaded catalog rows (provenance is batch/item tables, not `source`).
- Photographer upload origin is tracked through `photographer_upload_batches` / `photographer_upload_items` (and `photographer_id`), not through `image_assets.source`.
- Fotokey is generated **only** on admin approval, never at upload/submit time.
- Fotokey sequence follows **admin approval order** (request array order) for a given business date.
- No image is `ACTIVE` + `PUBLIC` until required derivatives exist and are `READY`.
- **Categories (PR-16I):** `photo_events.category_id` = event default; `image_assets.category_id` = canonical asset category. Staff approve + publish completion may copy event → asset when `image_assets.category_id` is null. Public catalog uses asset category first, else event category, for list/detail/filters/collections.
- Hard delete is blocked once `image_assets.fotokey` is non-null (`ASSET_HAS_FOTOKEY`).
- Runtime reads/writes should use **clean** tables, not legacy fixture tables, for production paths.

## Documentation rule for future PRs

Each future PR should update docs in this pattern:

1. If the PR changes current behavior, update the relevant top-level runbook/doc.
2. If the PR is a major implementation, add a detailed report under `reports/`.
3. Do not create loose one-off `.md` files in `docs/db-revamp/`.
4. Keep file names lowercase, hyphenated, and descriptive.
5. Prefer current names over legacy names unless documenting imported legacy data.

# Migration manifests

Generated, reviewable artifacts for scoped DB operations. **Do not run destructive SQL without an approved manifest.**

| Manifest | Spec | Status |
| --- | --- | --- |
| `contributor_migration_manifest.csv` | [Auth & identity revamp migration spec](../auth-identity-revamp-migration-spec.md) §6 | **Generated** (Development, 2026-05-31) |
| `contributor_migration_summary.json` | Same | **Generated** |
| `contributor-migration-report.sql` | Read-only SQL checks | Available |

**P0 result (Development):** 96 asset-owner rows → **93** canonical contributors (**3** `MERGE_INTO`, all `MANUAL`). Total assets listed: **729,598**.

**P1 applied (Development):** Merges executed; see `contributor_migration_p1_report.json` and [`auth-identity-revamp-migration-spec.md`](../auth-identity-revamp-migration-spec.md). Manifest generator / apply scripts removed after Dev cutover.

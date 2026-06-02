# Legacy event linking repair — Development baseline

**Recorded:** 2026-06-01  
**Branch:** Development (`apps/api/.dev.vars` `DATABASE_URL`)  
**Runbook:** [`legacy-event-linking-repair-runbook.md`](../legacy-event-linking-repair-runbook.md)

## Phase 0 results (pre-repair)

| Check | Value |
| --- | ---: |
| `asset_events` count | 50,000 |
| `asset_events` max `legacy_event_id` | 50,414 |
| `photo_events` count | 50,001 |
| Active legacy assets unlinked (`legacy_event_id > 0`) | 66,149 |
| Distinct `legacy_event_id` on assets | 54,495 |
| `eventtb` IMPORT_ERROR issues | 4,959 |
| Assets with `legacy_event_id = 0` | 143 |

## Canary: FC05032575

| Field | Value |
| --- | --- |
| `who_is_in_picture` | Nita Ambani |
| `headline` | Premiere of show The Phantom of the Opera at NMACC |
| `legacy_event_id` | 85370 |
| `event_id` | NULL |

## Post-repair targets

| Check | Target |
| --- | ---: |
| `asset_events` count | ~54,959 |
| `asset_events` max `legacy_event_id` | ~85,418 |
| Unlinked active legacy (`legacy_event_id > 0`) | 0 |
| FC05032575 `event_id` | non-NULL |
| Failed `eventtb` imports not in `asset_events` | 0 |

## Phase 1+ log

### Phase 1 — events re-import (2026-06-01)

**Command:** `pnpm --dir apps/api legacy:import -- --only events --batch-size 200`

**Result:** COMPLETED — 54,959 processed, **4,959 inserted**, 50,000 updated, **0 failed**  
**Batch ID:** `717dc05a-4be6-4b8d-a916-0d693765d1e9`

**Post Phase 1 verification:**

| Check | Value |
| --- | ---: |
| `asset_events` count | 54,959 |
| max `legacy_event_id` | 85,418 |
| Event 85370 present | yes |
| Failed imports not in DB | 0 |

**Next:** Phase 3 — `legacy:sync-clean-schema`, then validation.

### Phase 2 — backfill `assets.event_id` (2026-06-01)

**Preview:** 66,525 assets eligible for backfill

**SQL:** `UPDATE assets … FROM asset_events ae WHERE ae.legacy_event_id = a.legacy_event_id …`

**Result:**

| Check | Value |
| --- | ---: |
| Rows updated | 66,525 |
| Bad links (legacy id mismatch) | 0 |
| Assets still unlinked (`legacy_event_id > 0`) | 4 |
| FC05032575 `event_id` | `7ef24620-c26d-46c6-8cca-3daad34949b1` |
| FC05032575 event name | Premiere of show The Phantom of the Opera at NMACC |

Note: `image_assets.event_id` still NULL until Phase 3 sync. Four assets reference legacy events not present in `asset_events` — manual follow-up.

### Phase 3 — `legacy:sync-clean-schema` (2026-06-01)

**Blocker fixed:** `PHOTOGRAPHER_UPSERT` referenced dropped `contributors.legacy_status` / `legacy_payload` (P3 schema); removed from sync script.

**Command:** `pnpm --dir apps/api legacy:sync-clean-schema`

**Result:** ok — photoEventsUpserted 54,959, imageAssetsUpserted 735,227 (~3.9 min)

**Post Phase 3 verification:**

| Check | Value |
| --- | ---: |
| `photo_events` count | 54,960 |
| FC05032575 `event_id` | linked |
| FC05032575 event name | Premiere of show The Phantom of the Opera at NMACC |
| Active legacy unlinked (`legacy_event_id > 0`) | **0** |

**Phase 4 `db:validate:clean-sync`:** partial FAIL (pre-existing drift: event count +1, asset/derivative parity, 313 legacy rows with `event_id` NULL — mostly `legacy_event_id` 0 / null, not repair cohort)

**Next:** Phase 5 Typesense reindex (optional now); admin UI fix (Phase 6).

### Phase 6 — Admin catalog UI (2026-06-01, **complete**)

- Staff catalog **Who is in picture?** reads/writes `whoIsInPicture` → `image_assets.who_is_in_picture`
- API `PATCH /admin/assets/:id` accepts `whoIsInPicture`
- List row prefers `whoIsInPicture` over headline/event name for title column
- `headline` preserved on save (legacy eventhead; not edited in this panel)

### Phase 5 — Typesense reindex (2026-06-01, **complete**)

**Dry-run:** 724,385 index-eligible public assets  
**Command:** `pnpm --dir apps/api typesense:index-public-assets -- --batch-size 500`  
**Target collection:** `public_assets_current` via `https://search.fotocorp.com`  
**Result:** **724,385 indexed**, 1,449 batches, **0 failures**, ~44 min  
**Log:** `/tmp/typesense-reindex-phase5.log`

# Fotocorp Project Handbook

## Document Purpose

This document is the current internal source of truth for the Fotocorp project.

It exists to:

- explain the project to new developers and operators
- record what is already built
- record what is decided versus still provisional
- define how work should proceed while schema and business-rule decisions are still pending
- reduce confusion and architectural drift across frontend, backend, and platform work

This is an operating document, not a pitch deck and not a final architecture spec.

### How To Read This Document

- Read `Project Snapshot`, `Current Status`, and `Recommended Next Steps` first if you need quick orientation.
- Read `Architecture Overview`, `How the Pieces Connect`, and `Current Backend / Frontend / Jobs Responsibilities` if you are about to implement code.
- Read `Decisions Already Made`, `Current Limitations / Constraints / Risks`, and `Open Questions` before proposing new persistence or metadata work.
- Treat anything marked `provisional`, `pending`, or `[TO BE CONFIRMED]` as intentionally unresolved.

## Table Of Contents

1. [Project Snapshot](#project-snapshot)
2. [Current Status](#current-status)
3. [Scope Summary](#scope-summary)
4. [Core Project Principles](#core-project-principles)
5. [Architecture Overview](#architecture-overview)
6. [Monorepo Structure](#monorepo-structure)
7. [Current Development Approach](#current-development-approach)
8. [Decisions Already Made](#decisions-already-made)
9. [Current Limitations / Constraints / Risks](#current-limitations--constraints--risks)
10. [Current Workarounds](#current-workarounds)
11. [How The Pieces Connect](#how-the-pieces-connect)
12. [Current Backend / Frontend / Jobs Responsibilities](#current-backend--frontend--jobs-responsibilities)
13. [Environment / External Services](#environment--external-services)
14. [Process For Future Development](#process-for-future-development)
15. [Suggested Update Ritual](#suggested-update-ritual)
16. [Open Questions](#open-questions)
17. [Recommended Next Steps](#recommended-next-steps)
18. [Glossary / Terms](#glossary--terms)
19. [Appendix](#appendix)

## Project Snapshot

Fotocorp is a Shutterstock-style stock image platform under active development. The product direction is clear: browse, search, preview, inspect, and eventually license/download a large corpus of images while preserving the mapping between uploaded media and legacy metadata. The current technical stage is deliberately transitional: frontend, API, media-delivery, and operator/admin behavior are being developed in parallel using provisional DTOs, repository abstractions, shared sample contracts, and a sample R2 bucket, while the final production schema remains intentionally unlocked pending client confirmation on legacy field retention and business rules. The current top priority is to keep product and platform work moving without hardcoding premature schema assumptions.

## Current Status

### Complete

- Monorepo structure is established with `apps/web`, `apps/api`, `apps/jobs`, and `packages/*`.
- Web app exists with marketing, browse/search, asset detail, and admin shell routes.
- API worker exposes provisional browse, search, asset detail, admin asset inspection, media, and ingestion endpoints.
- Private preview/original media architecture is established in the API worker against a sample R2 binding.
- Shared ingestion run contract exists in `packages/shared/src/ingestion.ts`.
- Jobs worker has a minimal ingestion-runner shell and fixture-backed repository.
- Field decision workbook exists at `docs/field-decision-workbook.md`.

### In Progress

- Uploading originals into Cloudflare R2.
- Parallel implementation of frontend behavior, backend contracts, and operator/admin flows.
- Replacement of fixture-only assumptions with API-backed flows where contracts are stable enough.
- Clarifying legacy metadata handling and eventual ingestion/import rules.

### Blocked

- Final database schema is blocked on client confirmation.
- Final import behavior is blocked on decisions about which legacy fields to keep, rename, drop, or derive.
- Final licensing and original-download entitlement logic is blocked on client business-rule confirmation.

### Intentionally Deferred

- Final Neon schema and migrations.
- Full queue orchestration for jobs.
- Final import pipeline into persistent storage.
- Final watermark/image-transformation stack.
- Final object-key strategy beyond current stored-key usage.
- Final admin/operator workflow rules beyond current provisional views.

### Infrastructure Currently Active

- `apps/web` runs as a Next.js app prepared for Cloudflare via OpenNext.
- `apps/api` runs as a Cloudflare Worker.
- `apps/jobs` runs as a Cloudflare Worker.
- API currently binds a sample R2 bucket named `fotocorp-sample-media`.
- `DATABASE_URL` exists as an environment variable boundary in the API worker, but Neon is not currently part of active runtime behavior.

## Scope Summary

### What The Product Is Supposed To Do

- Provide a stock-image browsing and search experience.
- Show preview imagery and asset metadata.
- Protect originals and eventually gate access based on business rules.
- Provide internal/admin tooling for asset inspection and ingestion monitoring.
- Support eventual legacy metadata import and normalization.

### Current Confirmed Behaviors

- Public browse/search/detail behavior is available through provisional API DTOs.
- Media previews are delivered privately through the API worker, not via public bucket URLs.
- Original media access is intentionally blocked behind a controlled placeholder response.
- Admin endpoints expose asset inspection and ingestion run monitoring shapes.
- Web app can operate against fixtures, API, or auto-fallback mode.

### Out Of Scope For Now

- Final customer entitlement engine.
- Final purchase/licensing workflow.
- Final schema and migrations.
- Full production ingestion orchestration and persistence.
- Final contributor/category/rights domain model.

### Later Phases

- Production schema lock and migrations.
- Legacy database reconciliation and import rollout.
- Real entitlement enforcement and licensing model.
- Full jobs orchestration, retries, and scheduled execution.
- Production bucket switch-over and corpus-scale ingestion.

## Core Project Principles

- Preserve image-to-metadata mapping as a first-class requirement.
- Do not finalize schema prematurely.
- Keep originals protected by default.
- Use the sample bucket for development where appropriate.
- Build contract boundaries before locking persistence.
- Prefer provisional DTOs over leaking legacy/source field names into app-facing contracts.
- Prefer repository abstractions over direct persistence coupling.
- Keep PRs independently mergeable.
- Separate operator-facing functionality from unfinished ingestion internals.
- Be explicit about uncertainty with `[TO BE CONFIRMED]` instead of inventing false certainty.

## Architecture Overview

### High-Level App Relationship

- `apps/web` is the user and operator-facing application shell.
- `apps/api` is the contract and media-delivery boundary for browse/search/admin/media endpoints.
- `apps/jobs` is the future execution/orchestration boundary for ingestion and related background work.
- `packages/shared` currently contains shared ingestion contracts.
- `packages/db` and `packages/storage` exist as placeholders for future shared implementations.

### Current Provisional Data Flow

- Web reads asset/admin/ingestion data through a repository interface.
- Web repository can use:
  - API mode
  - fixture mode
  - auto mode with API-first and fixture fallback
- API serves fixture-backed data through service and repository abstractions.
- Shared ingestion-run shapes are consumed by both API and jobs.

### Storage Flow

- Originals are intended to live in Cloudflare R2.
- A smaller sample R2 bucket is used for current media-development flows.
- API preview delivery reads privately from R2 and streams through the worker.
- Original delivery is intentionally protected and not yet implemented as an unlocked download path.

### Sample Bucket vs Real Bucket

- Sample bucket is the currently active runtime binding in the API worker.
- Real bucket/original corpus upload is happening outside the currently committed runtime flow.
- The codebase treats storage behind abstractions so the sample bucket can be swapped later with minimal route changes.
- Real bucket naming, full object-key conventions, and promotion strategy are still `[TO BE CONFIRMED]`.

### Where Neon Fits

- Neon is present as a future persistence boundary, not as the current runtime source of truth.
- `@neondatabase/serverless` is installed in `apps/api`.
- `DATABASE_URL` exists in the API environment shape.
- Current runtime behavior does not depend on Neon-backed read/write logic.

### High-Level System Connection

1. Frontend calls repository abstractions.
2. Repository either hits API or falls back to fixtures depending on configuration.
3. API returns provisional DTOs backed by fixture/sample data.
4. Media requests flow through API to private R2 access.
5. Jobs exposes a provisional runner surface but does not yet execute real ingestion tasks.
6. Final DB/schema/import layers remain pending client confirmation and future implementation.

## Monorepo Structure

### Top-Level Layout

```text
.
├── apps/
│   ├── api/
│   ├── jobs/
│   └── web/
├── docs/
│   ├── field-decision-workbook.md
│   └── fotocorp-project-handbook.md
├── packages/
│   ├── db/
│   ├── shared/
│   └── storage/
├── package.json
└── pnpm-workspace.yaml
```

### Important Runtime Areas

```text
apps/web/src/
├── app/
│   ├── (marketing)/
│   └── admin/
├── components/
├── features/assets/repository/
├── lib/fixtures/
└── types/

apps/api/src/
├── index.ts
├── lib/
├── routes/
└── services/

apps/jobs/src/
├── index.ts
└── lib/
```

### Major App / Package Purpose

- `apps/web`
  - Next.js application for public browse/search flows and internal admin screens.
  - Holds the frontend repository-selection logic and fixture fallback behavior.
- `apps/api`
  - Worker-based contract layer for asset data, admin data, private media, and ingestion monitoring.
  - Owns DTOs, service boundaries, repository boundaries, and media-delivery behavior.
- `apps/jobs`
  - Worker-based shell for future ingestion execution/orchestration.
  - Currently exposes an ingestion-runner status payload only.
- `packages/shared`
  - Shared contracts currently used for ingestion runs.
- `packages/db`
  - Placeholder package for future shared DB concerns.
- `packages/storage`
  - Placeholder package for future shared storage concerns.

### Important Config Files

- `package.json`
  - root dev orchestration for `web`, `api`, and `jobs`
- `pnpm-workspace.yaml`
  - workspace package registration
- `apps/web/wrangler.jsonc`
  - Cloudflare/OpenNext worker config for web
- `apps/api/wrangler.jsonc`
  - API Worker config and sample R2 binding
- `apps/jobs/wrangler.jsonc`
  - Jobs Worker config
- `apps/web/.env.example`
  - documented frontend repo-selection variables

### Runtime Code vs Shared Code vs Docs vs Future Areas

- Runtime code:
  - `apps/web`
  - `apps/api`
  - `apps/jobs`
- Shared code:
  - `packages/shared`
- Documentation:
  - `docs/*`
  - `apps/api/README.md`
  - `apps/jobs/README.md`
- Future areas / placeholders:
  - `packages/db`
  - `packages/storage`

## Current Development Approach

Development is intentionally proceeding before final schema lock because the team already knows a meaningful amount about product behavior even though the legacy field model is not finalized.

Current working model:

- frontend builds against provisional contracts
- backend implements those contracts through service/repository boundaries
- fixture/sample-backed implementations unblock iteration
- final DB schema and import behavior are postponed until client decisions are available

Why this works:

- browse/search/admin/media behavior can be shaped before persistence is final
- provisional DTOs reduce churn in UI implementation
- repository abstractions isolate future Neon adoption
- sample-bucket-backed media access allows private-delivery behavior to be exercised early

Rule for this phase:

- do not treat current fixture shapes as final schema
- do not let raw legacy columns leak into app-facing contracts by default
- do not block independent vertical slices on unresolved schema details when stable boundaries can be introduced first

## Decisions Already Made

### Infrastructure Decisions

#### Decision

Use a pnpm monorepo with separate `web`, `api`, and `jobs` apps.

- Status: final
- Reason: clean separation of runtime concerns while keeping development coordinated
- Impact: app responsibilities are clearer and independent PRs are easier to land

#### Decision

Use Cloudflare Workers for `apps/api` and `apps/jobs`.

- Status: final
- Reason: aligns with current deployment/platform direction already present in repo config
- Impact: service boundaries and bindings are Worker-oriented

#### Decision

Use a sample R2 bucket binding in API for current media development.

- Status: provisional
- Reason: enables real private-media behavior without requiring the full corpus or final production storage wiring
- Impact: media behavior can be exercised now, but results only reflect the sample bucket

### Architecture Decisions

#### Decision

Frontend reads through repository abstractions with API/fixture/auto selection.

- Status: provisional
- Reason: keeps UI work moving while backend availability and contracts mature
- Impact: frontend can progress even when API or data source is incomplete

#### Decision

Backend uses DTOs and repository abstractions instead of hardcoding final persistence assumptions.

- Status: provisional
- Reason: final schema is not approved yet
- Impact: API shapes can stabilize earlier than schema

#### Decision

Preview delivery and original delivery are separate concerns.

- Status: provisional
- Reason: originals must remain protected, and entitlement logic is not finalized
- Impact: preview and original routes can evolve independently

#### Decision

Ingestion run models are shared between API and jobs.

- Status: provisional
- Reason: operator-facing monitoring can be shaped before real orchestration exists
- Impact: jobs and admin views can converge on one contract early

### Temporary / Provisional Decisions

#### Decision

Fixture/sample-backed repositories are the current source of truth for many flows.

- Status: provisional
- Reason: runtime behavior is needed before final data import/persistence is ready
- Impact: current outputs are representative, not production-authoritative

#### Decision

API media original route returns a gated placeholder rather than actual original access.

- Status: provisional
- Reason: entitlement and licensing rules are not finalized
- Impact: backend architecture can advance without exposing originals

#### Decision

Shared ingestion contracts are imported via repo-local source paths in app code.

- Status: provisional
- Reason: workspace package resolution is not fully wired for app typechecking yet
- Impact: shared model exists, but import ergonomics should be cleaned up later

### Intentionally Deferred Decisions

#### Decision

Do not finalize the production schema yet.

- Status: pending
- Reason: client confirmation is still required on legacy field handling
- Impact: persistence and migration work must remain flexible

#### Decision

Do not finalize licensing or entitlement enforcement rules yet.

- Status: pending
- Reason: business-rule inputs are still missing
- Impact: download/original access remains architecture-only for now

#### Decision

Do not finalize ingestion orchestration or import behavior yet.

- Status: pending
- Reason: import rules, queueing, and persistence are not settled
- Impact: jobs remains a placeholder shell rather than an execution engine

## Current Limitations / Constraints / Risks

### Limitations

- Upload of the full corpus is still in progress.
- Final metadata schema is not approved.
- Legacy data semantics remain ambiguous.
- Ingestion logic is not finalized.
- Sample bucket is only a small development subset, not the full corpus.
- Web admin pages still include fixture-oriented assumptions in their own local fixture models.
- `packages/db` and `packages/storage` are placeholders, not active shared implementations.
- Jobs worker does not run actual mapping/import work yet.

### Constraints

- Originals must remain protected.
- Product work must continue before schema lock.
- Client confirmation is still needed for key metadata and licensing decisions.
- API contract stability is more important right now than final persistence shape.

### Risks

- Contract drift between web fixture models and API DTOs.
- Schema drift if developers begin treating current fixture fields as final.
- Admin/operator expectations drifting ahead of confirmed ingestion capabilities.
- Media access logic being designed without final licensing inputs.
- Shared package boundaries remaining half-adopted if not cleaned up deliberately.
- Real bucket/object-key conventions diverging from current provisional assumptions.

## Current Workarounds

These are active temporary workarounds and should not be mistaken for final architecture unless explicitly confirmed later.

- Sample R2 bucket for current media development.
- Provisional API DTOs for browse/search/admin/media flows.
- Fixture-backed repository implementations in API.
- Fixture fallback mode in web via `NEXT_PUBLIC_ASSET_DATA_SOURCE`.
- Delayed final schema/migration work pending client confirmation.
- Gated placeholder response for original media access.
- Jobs runner shell with sample ingestion runs instead of real execution.
- Repo-local imports for shared ingestion contracts instead of fully resolved workspace package usage.

## How The Pieces Connect

### User Browsing / Search Flow

1. User opens web browse/search pages in `apps/web`.
2. Web asks `getAssetRepository()` for a repository implementation.
3. Repository mode is selected from environment:
   - `fixture`
   - `api`
   - `auto`
4. In API or auto mode, web calls `apps/api` routes such as:
   - `GET /assets`
   - `GET /assets/:id`
   - `GET /search?q=...`
5. API serves provisional DTOs from services backed by fixture repositories.
6. Web renders UI against those app-facing DTOs.

### Preview Image Delivery Flow

1. Web receives a `previewUrl` from API DTOs.
2. That URL points to `GET /media/preview/:key`.
3. API resolves preview metadata through `PreviewService`.
4. API reads the object privately from the R2 sample bucket through `StorageService`.
5. API streams the object back with controlled headers.
6. Watermark/transformation hooks are represented in architecture, but actual image-processing is not yet implemented.

### Gated / Original Download Flow

1. Web receives an original URL via current media-access structure.
2. That URL points to `GET /media/original/:key`.
3. API checks object existence and returns a controlled gated response.
4. No final entitlement decision is made yet.
5. Future original delivery should plug client-approved business rules into this boundary rather than bypassing it.

### Admin Asset Inspection Flow

1. Operator opens admin asset pages in `apps/web`.
2. Web repository calls API admin endpoints in API mode or uses fixture fallback otherwise.
3. API returns admin DTOs with extra inspection fields such as:
   - `storageKey`
   - `checksumSha256`
   - raw metadata object
   - ingestion status and run id
4. Admin UI uses those records to inspect mapping completeness and storage context.

### Ingestion / Admin Monitoring Flow

1. Operator opens admin ingestion page in `apps/web`.
2. Web repository asks for ingestion run data.
3. API returns:
   - `GET /admin/ingestion/runs`
   - `GET /admin/ingestion/runs/:id`
4. Those responses use shared provisional ingestion contracts.
5. Jobs worker independently exposes a current runner/status payload for future execution boundaries.

### Future Legacy Import Flow

1. Legacy/source data inventory is reviewed with client confirmation.
2. Field decisions are captured in the field workbook.
3. Final schema is designed from approved app-facing and admin-facing requirements.
4. Jobs runner becomes the orchestration boundary for mapping/import tasks.
5. Repository implementations are upgraded from fixtures to real persistence.
6. API DTOs remain stable where possible while persistence changes under them.

## Current Backend / Frontend / Jobs Responsibilities

### `apps/web`

Owns:

- public browse/search/detail UI
- admin shell UI
- asset repository selection and fallback behavior
- fixture-based UX continuity while backend evolves

Should not own:

- final persistence logic
- private media access implementation
- ingestion execution logic
- final schema definitions

### `apps/api`

Owns:

- provisional app-facing and admin-facing DTOs
- service/repository boundaries
- private preview/original media boundary
- admin asset inspection endpoints
- ingestion run API contracts

Should not own:

- final import orchestration
- direct UI concerns
- final business entitlement decisions before confirmation

### `apps/jobs`

Owns:

- provisional ingestion-runner boundary
- future home for mapping/import execution
- future background-task orchestration surface

Should not own:

- user-facing browse/search endpoints
- frontend-specific fixture logic
- direct schema finalization decisions

## Environment / External Services

### Cloudflare R2

- Purpose: object storage for image assets
- Current usage:
  - sample bucket is actively bound in `apps/api`
  - real/original corpus upload exists as a project reality but is not fully represented as an active runtime binding in the current codebase

### Sample Bucket

- Purpose: support real private-media development without depending on the full corpus
- Current repo usage:
  - API binding `MEDIA_BUCKET`
  - configured bucket name: `fotocorp-sample-media`

### Real Bucket

- Purpose: eventual home for production originals and larger corpus storage
- Current repo state:
  - acknowledged as part of project reality
  - not yet represented as a finalized active runtime binding in current code
  - exact runtime integration remains `[TO BE CONFIRMED]`

### Cloudflare Workers

- `apps/api` and `apps/jobs` run as Workers
- `apps/web` is prepared for Cloudflare deployment through OpenNext

### Neon

- Purpose: future persistent database layer
- Current repo state:
  - `@neondatabase/serverless` is installed in API
  - `DATABASE_URL` boundary exists
  - not currently used for production runtime reads/writes in the committed implementation

### Other Visible Services / Tooling

- OpenNext for Cloudflare deployment of the web app
- Next.js for frontend application
- pnpm workspaces for monorepo management

No secrets or private values should be documented in this handbook.

## Process For Future Development

- Keep PRs independent and mergeable.
- Prefer narrow vertical slices over broad speculative refactors.
- Do not hardcode final schema assumptions into runtime code.
- Prefer app-facing DTO changes only when the product contract actually changes.
- Put persistence uncertainty behind repository abstractions.
- Put media uncertainty behind preview/media/storage abstractions.
- Record decisions in this handbook and field questions in `docs/field-decision-workbook.md`.
- Update status after each meaningful PR that changes architecture, boundaries, or active workarounds.
- When proposing new work:
  1. state whether it is final, provisional, or pending
  2. describe what boundary it belongs to
  3. explain what it avoids assuming
- Upgrade provisional decisions to final only after:
  - client confirmation
  - implementation boundary review
  - explicit handbook update

## Suggested Update Ritual

- Update this handbook after each merged PR that changes:
  - current status
  - active infrastructure
  - major routes/contracts
  - responsibilities
  - project risks or workarounds
- Record major decisions immediately rather than batching them later.
- Move items from `provisional` or `pending` to `final` only when evidence exists.
- Add new blockers as soon as they are discovered.
- Keep `Current Status`, `Decisions Already Made`, `Current Workarounds`, and `Recommended Next Steps` fresh.
- If a section becomes outdated but not yet resolved, mark it `[TO BE CONFIRMED]` instead of leaving stale certainty in place.

## Open Questions

- Which final metadata fields are kept, renamed, dropped, or derived from legacy sources?
- Which fields should be searchable in production?
- Which metadata fields are public versus admin-only?
- What exact licensing and entitlement conditions allow original access?
- What exact ingestion rules apply to mapping, validation, preview generation, and import?
- What is the final object-key strategy across sample and real buckets?
- How should contributor/category concepts be modeled, if at all?
- What admin/operator capabilities are required beyond current inspection and monitoring?
- Should raw legacy/source metadata be preserved fully, partially, or only via normalized output?
- How should web fixture admin models converge with API-backed admin contracts?

## Recommended Next Steps

1. Use the field decision workbook with the client to resolve legacy field classification.
2. Align web admin ingestion and asset views more directly to API-backed contracts and reduce local admin-fixture drift.
3. Define the first real schema proposal only after field decisions and licensing inputs are reviewed.
4. Keep extending API/admin/operator flows using repository-backed boundaries rather than schema-specific assumptions.
5. Add the next jobs-worker vertical slice as a non-final ingestion task boundary, not a full orchestration system.
6. Decide how the real bucket will be represented in runtime config and promotion flow.
7. Define the first entitlement/original-access decision set once client business rules are available.
8. Clean up shared package consumption so `packages/shared` is used ergonomically without repo-local import workarounds.

## Glossary / Terms

- Original
  - full asset object intended to remain protected until business rules allow access
- Preview
  - lower-risk viewable media delivered through the API worker
- Sample bucket
  - smaller R2 bucket used for development and media-flow validation
- Real bucket
  - eventual production-scale R2 storage for the main corpus
- Legacy metadata
  - existing source-system fields and mappings that still need client review
- Provisional DTO
  - app-facing API contract intentionally designed ahead of final schema lock
- Repository abstraction
  - interface that hides whether data comes from fixtures, API, or future persistence
- Ingestion run
  - operator-visible record of a mapping/import process with status, counts, and errors
- Operator
  - internal admin user responsible for catalog, storage, or ingestion monitoring

## Appendix

### Route Inventory

Current visible API routes in `apps/api`:

- `GET /health`
- `GET /assets`
- `GET /assets/:id`
- `GET /search?q=...`
- `GET /media/preview/:key`
- `GET /media/access/:key`
- `GET /media/original/:key`
- `GET /admin/assets`
- `GET /admin/assets/:id`
- `GET /admin/ingestion/runs`
- `GET /admin/ingestion/runs/:id`

Current visible jobs route in `apps/jobs`:

- `GET /`

Current visible web route areas in `apps/web/src/app`:

- marketing home
- search
- asset detail
- downloads
- favorites
- pricing
- admin dashboard
- admin assets
- admin ingestion
- admin storage

### Package Inventory

- `@fotocorp/shared`
  - active
- `@fotocorp/db`
  - placeholder
- `@fotocorp/storage`
  - placeholder

### Status Legend

- final
  - expected to remain unless intentionally revised
- provisional
  - active working decision subject to change
- pending
  - unresolved and awaiting confirmation or later implementation

### Related Documents

- Field decision workbook:
  - `docs/field-decision-workbook.md`

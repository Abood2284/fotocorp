# Photographer events (PR-12)

## Summary

Photographers can list, create, and edit their own events directly in `photo_events`. There is **no** `photographer_event_submissions` table. Upload and admin approval queues are deferred.

## Schema

New nullable provenance columns on `photo_events`:

- `created_by_photographer_id` → `photographers(id)` ON DELETE SET NULL  
- `created_by_photographer_account_id` → `photographer_accounts(id)` ON DELETE SET NULL  
- `created_by_source` — `LEGACY_IMPORT` | `ADMIN` | `PHOTOGRAPHER` | `SYSTEM` (default `LEGACY_IMPORT` for existing rows)

`photo_events.source` (row origin) now allows `PHOTOGRAPHER` in addition to `LEGACY_IMPORT` and `MANUAL`. Photographer-created rows use `source = 'PHOTOGRAPHER'`, `status = 'ACTIVE'`, and `created_by_source = 'PHOTOGRAPHER'` with both creator FKs set.

## API (session required)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/photographer/events` | List with `scope=mine` (creator = session photographer) or `scope=available` (`status = ACTIVE`), optional `q`, `limit`, `offset`. |
| `POST` | `/api/v1/photographer/events` | Create event (allowed metadata fields only). |
| `GET` | `/api/v1/photographer/events/:eventId` | Detail if `ACTIVE` or owned by session photographer. |
| `PATCH` | `/api/v1/photographer/events/:eventId` | Update metadata only if `created_by_photographer_id` matches session. |

Responses include `canEdit`: `true` only when the event was created by the current photographer. **Available** listings are read-only for events the photographer does not own.

## Web

- `/photographer/events` — My events / Available events, search, table, create + conditional edit.  
- `/photographer/events/new` — Create form.  
- `/photographer/events/[eventId]/edit` — Edit owned events only; otherwise a clear “cannot edit” message.

## Validation / smoke

- `pnpm --dir apps/api db:validate:photographer-events`  
- `pnpm --dir apps/api smoke:photographer-events` (HTTP only with `PHOTOGRAPHER_SMOKE_USERNAME` / `PHOTOGRAPHER_SMOKE_PASSWORD`)

## Deferred

- Bulk upload attaching to events.  
- Admin approval of images.  
- Event delete / archive from the portal.  
- Extra event workflow statuses.

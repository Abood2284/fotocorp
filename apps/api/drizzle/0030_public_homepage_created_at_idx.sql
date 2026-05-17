-- Homepage latest-events feed: filter active events by created_at (recently added events).
CREATE INDEX IF NOT EXISTS "photo_events_active_created_at_idx"
  ON "photo_events" ("created_at" DESC)
  WHERE "status" = 'ACTIVE';

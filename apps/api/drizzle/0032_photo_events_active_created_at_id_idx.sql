-- Latest-events cursor pagination: active events ordered by created_at then id.
CREATE INDEX IF NOT EXISTS "photo_events_active_created_at_id_idx"
  ON "photo_events" ("created_at" DESC, "id" DESC)
  WHERE "status" = 'ACTIVE';

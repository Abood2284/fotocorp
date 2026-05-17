-- Homepage / catalog: partial indexes for public event and asset joins (event_date index retained for date-based browse).
CREATE INDEX IF NOT EXISTS "photo_events_active_event_date_idx"
  ON "photo_events" ("event_date" DESC)
  WHERE "status" = 'ACTIVE' AND "event_date" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "image_assets_public_event_idx"
  ON "image_assets" ("event_id", "image_date" DESC, "created_at" DESC)
  WHERE "status" = 'ACTIVE' AND "visibility" = 'PUBLIC';

CREATE INDEX IF NOT EXISTS "image_derivatives_ready_card_asset_idx"
  ON "image_derivatives" ("image_asset_id")
  WHERE "variant" = 'CARD' AND "generation_status" = 'READY';

CREATE TABLE IF NOT EXISTS public_event_feed_items (
  event_id uuid PRIMARY KEY REFERENCES photo_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date timestamptz NULL,
  created_at timestamptz NOT NULL,
  asset_count integer NOT NULL DEFAULT 0,
  preview_asset_id uuid NULL REFERENCES image_assets(id) ON DELETE SET NULL,
  preview_width integer NULL,
  preview_height integer NULL,
  preview_url text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_event_feed_items_public_created_idx
  ON public_event_feed_items (created_at DESC, event_id DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS public_event_feed_items_public_event_date_idx
  ON public_event_feed_items (event_date DESC, event_id DESC)
  WHERE is_public = true AND event_date IS NOT NULL;

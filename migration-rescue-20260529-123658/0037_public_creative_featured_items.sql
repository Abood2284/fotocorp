CREATE TABLE IF NOT EXISTS public_creative_featured_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  asset_id uuid NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  rank integer NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_creative_featured_items_period_key_check
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT public_creative_featured_items_rank_check
    CHECK (rank > 0),
  CONSTRAINT public_creative_featured_items_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS public_creative_featured_items_period_rank_uidx
  ON public_creative_featured_items (period_key, rank);

CREATE UNIQUE INDEX IF NOT EXISTS public_creative_featured_items_period_asset_uidx
  ON public_creative_featured_items (period_key, asset_id);

CREATE INDEX IF NOT EXISTS public_creative_featured_items_active_period_rank_idx
  ON public_creative_featured_items (period_key, rank)
  WHERE status = 'ACTIVE';

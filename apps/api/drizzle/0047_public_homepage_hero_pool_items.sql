CREATE TABLE IF NOT EXISTS public_homepage_hero_pool_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
  position integer NOT NULL,
  selected_by_staff_member_id uuid NULL REFERENCES staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_homepage_hero_pool_items_position_check CHECK (position >= 1 AND position <= 25)
);

CREATE UNIQUE INDEX IF NOT EXISTS public_homepage_hero_pool_items_asset_uidx
  ON public_homepage_hero_pool_items (asset_id);

CREATE UNIQUE INDEX IF NOT EXISTS public_homepage_hero_pool_items_position_uidx
  ON public_homepage_hero_pool_items (position);

CREATE INDEX IF NOT EXISTS public_homepage_hero_pool_items_position_idx
  ON public_homepage_hero_pool_items (position);

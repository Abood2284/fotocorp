CREATE TABLE IF NOT EXISTS public_homepage_hero_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_key text NOT NULL,
  active_from timestamptz NOT NULL,
  active_until timestamptz NOT NULL,
  generated_at timestamptz NOT NULL,
  generation_run_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_homepage_hero_sets_active_window_check CHECK (active_until > active_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS public_homepage_hero_sets_set_key_uidx
  ON public_homepage_hero_sets (set_key);

CREATE INDEX IF NOT EXISTS public_homepage_hero_sets_active_window_idx
  ON public_homepage_hero_sets (active_from, active_until);

CREATE TABLE IF NOT EXISTS public_homepage_hero_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public_homepage_hero_sets(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  asset_id uuid NOT NULL REFERENCES image_assets(id) ON DELETE CASCADE,
  preview_url text NOT NULL,
  title text NOT NULL,
  event_id uuid NULL,
  event_name text NULL,
  fotokey text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_homepage_hero_set_items_slot_check CHECK (slot > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS public_homepage_hero_set_items_set_slot_uidx
  ON public_homepage_hero_set_items (set_id, slot);

CREATE INDEX IF NOT EXISTS public_homepage_hero_set_items_set_slot_idx
  ON public_homepage_hero_set_items (set_id, slot);

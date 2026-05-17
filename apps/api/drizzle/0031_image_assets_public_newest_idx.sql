-- Homepage newest-assets slice: public ACTIVE assets ordered by image/created date.
CREATE INDEX IF NOT EXISTS "image_assets_public_newest_idx"
  ON "image_assets" ("image_date" DESC, "created_at" DESC)
  WHERE "status" = 'ACTIVE' AND "visibility" = 'PUBLIC';

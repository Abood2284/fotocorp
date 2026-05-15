/** Tiled watermark pixels + stored profile for `DETAIL` preview derivatives (unchanged string for existing rows). */
export const CURRENT_WATERMARK_PROFILE = "fotocorp-preview-v4-dense-dark-lowquality";

/** Stored on `image_derivatives` for clean thumb rows (object still under `previews/watermarked/thumb/`). */
export const THUMB_CLEAN_PROFILE = "fotocorp-thumb-clean-v1";

/** Stored on `image_derivatives` for clean card rows (object still under `previews/watermarked/card/`). */
export const CARD_CLEAN_PROFILE = "fotocorp-card-clean-v1";

/** Detail preview uses the tiled watermark; DB profile matches `CURRENT_WATERMARK_PROFILE`. */
export const DETAIL_WATERMARKED_PROFILE = CURRENT_WATERMARK_PROFILE;

export const WATERMARK_PROFILE_VERSION = CURRENT_WATERMARK_PROFILE;

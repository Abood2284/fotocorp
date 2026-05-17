import { sql, type SQL } from "drizzle-orm"
import {
  CARD_CLEAN_PROFILE,
  CURRENT_WATERMARK_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../media/watermark"

export function publicAssetPredicate(alias: string): SQL {
  return sql.raw(
    `${alias}.status = 'ACTIVE' and ${alias}.visibility = 'PUBLIC' and ${alias}.media_type = 'IMAGE' and ${alias}.original_exists_in_storage = true`,
  )
}

export function joinPublicCardDerivative(assetAlias: string, cardAlias: string): SQL {
  return sql`join image_derivatives ${sql.raw(cardAlias)}
    on ${sql.raw(cardAlias)}.image_asset_id = ${sql.raw(assetAlias)}.id
    and ${sql.raw(cardAlias)}.variant = 'CARD'
    and ${sql.raw(cardAlias)}.generation_status = 'READY'
    and ${sql.raw(cardAlias)}.is_watermarked = false
    and ${sql.raw(cardAlias)}.watermark_profile = ${CARD_CLEAN_PROFILE}`
}

export function expectedPublicPreviewProfile(variant: "thumb" | "card" | "detail"): string {
  if (variant === "thumb") return THUMB_CLEAN_PROFILE
  if (variant === "card") return CARD_CLEAN_PROFILE
  return CURRENT_WATERMARK_PROFILE
}

export function publicPreviewIsWatermarked(variant: "thumb" | "card" | "detail"): boolean {
  return variant === "detail"
}

export function toDerivativeVariant(variant: "thumb" | "card" | "detail"): "THUMB" | "CARD" | "DETAIL" {
  return variant.toUpperCase() as "THUMB" | "CARD" | "DETAIL"
}

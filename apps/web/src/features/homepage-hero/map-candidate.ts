import type { PublicAsset } from "@/features/assets/types"
import type { HomepageHeroPoolCandidate } from "@/features/homepage-hero/types"

export function mapPublicAssetToHeroCandidate(asset: PublicAsset): HomepageHeroPoolCandidate {
  const cardPreview = asset.previews.card
  return {
    assetId: asset.id,
    fotokey: asset.fotokey ?? null,
    title: resolveHeroCandidateTitle(asset),
    eventId: asset.event?.id ?? null,
    eventName: asset.event?.name ?? null,
    imageDate: asset.imageDate,
    cardPreviewReady: Boolean(cardPreview?.url),
    previewUrl: cardPreview?.url ?? null,
    previewWidth: cardPreview?.width ?? null,
    previewHeight: cardPreview?.height ?? null,
  }
}

function resolveHeroCandidateTitle(asset: PublicAsset): string {
  return (
    asset.event?.name?.trim()
    || asset.headline?.trim()
    || asset.caption?.trim()
    || asset.fotokey?.trim()
    || "Fotocorp image"
  )
}

export const HOMEPAGE_HERO_POOL_SIZE = 25

export interface HomepageHeroPoolItem {
  position: number
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  cardPreviewReady: boolean
}

export interface HomepageHeroPoolResponse {
  poolSize: number
  items: HomepageHeroPoolItem[]
  updatedAt: string | null
}

export interface HomepageHeroPoolCandidate {
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  imageDate: string | null
  cardPreviewReady: boolean
  previewUrl?: string | null
  previewWidth?: number | null
  previewHeight?: number | null
}

export interface HomepageHeroPoolCandidatesResponse {
  items: HomepageHeroPoolCandidate[]
  nextCursor: string | null
}

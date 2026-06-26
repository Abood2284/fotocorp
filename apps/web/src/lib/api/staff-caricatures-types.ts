export interface StaffCaricatureListItem {
  id: string
  headline: string
  credit: string
  categoryId: string
  categoryName: string
  language: string
  status: string
  hasVisibleText: boolean
  hasOriginalFile: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface StaffCaricatureListResponse {
  items: StaffCaricatureListItem[]
  total: number
  page: number
  limit: number
}

export interface StaffCaricatureDetail extends StaffCaricatureListItem {
  description: string
  languageOther: string | null
  visibleText: string | null
  visibleTextTranslationEn: string | null
  keywords: string[]
  depictedSubjects: string[]
  visibility: string
  hasReadyPreviewDerivatives: boolean
  previewGenerationStatus: string
}

export interface StaffCaricatureApproveResponse {
  ok: true
  assetId: string
  jobId: string
  message: string
}

export interface StaffCaricatureRejectResponse {
  ok: true
  assetId: string
}

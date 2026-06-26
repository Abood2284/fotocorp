export interface HelpContextualLinkSeed {
  contextKey: string
  articleSlug: string
  label?: string
  description?: string
  displayOrder?: number
}

export const HELP_CONTEXTUAL_LINK_SEEDS: HelpContextualLinkSeed[] = [
  { contextKey: "staff.assets.upload", articleSlug: "how-to-upload-editorial-images", displayOrder: 10 },
  {
    contextKey: "staff.assets.caption-edit",
    articleSlug: "how-to-edit-an-asset-caption",
    displayOrder: 10,
  },
  {
    contextKey: "staff.assets.caption-edit",
    articleSlug: "caption-writing-rules",
    displayOrder: 20,
  },
  {
    contextKey: "staff.uploads.review",
    articleSlug: "how-to-approve-contributor-uploads",
    displayOrder: 10,
  },
  { contextKey: "staff.assets.list", articleSlug: "how-to-search-assets", displayOrder: 10 },
  { contextKey: "staff.assets.list", articleSlug: "how-to-edit-asset-metadata", displayOrder: 20 },
  {
    contextKey: "staff.customer-access.inquiries",
    articleSlug: "how-to-review-customer-access-inquiries",
    displayOrder: 10,
  },
  { contextKey: "staff.download-logs.list", articleSlug: "how-to-check-download-logs", displayOrder: 10 },
  { contextKey: "staff.videos.upload", articleSlug: "how-to-upload-videos", displayOrder: 10 },
  { contextKey: "staff.caricatures.upload", articleSlug: "how-to-upload-caricatures", displayOrder: 10 },
]

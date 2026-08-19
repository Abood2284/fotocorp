import type { ContextualHelpLinkItem } from "@/components/staff/help/contextual-help-links"
import type { ContributorUploadType } from "@/lib/contributors/allowed-upload-types"

export const CONTRIBUTOR_HELP_ARTICLE_SLUGS = [
  "how-to-upload-editorial-images",
  "how-to-upload-caricature-images",
  "how-to-upload-caricatures",
] as const

export function isContributorHelpArticleSlug(slug: string) {
  return (CONTRIBUTOR_HELP_ARTICLE_SLUGS as readonly string[]).includes(slug)
}

export function buildContributorHelpArticleHref(slug: string) {
  return `/contributor/help/${encodeURIComponent(slug)}`
}

export function getContributorHelpMediaDisplayUrl(mediaId: string) {
  return `/api/contributor/help/media/${encodeURIComponent(mediaId)}`
}

export function getContributorHelpLinkItems(
  allowedUploadTypes: readonly ContributorUploadType[],
): ContextualHelpLinkItem[] {
  const items: ContextualHelpLinkItem[] = []

  for (const type of allowedUploadTypes) {
    switch (type) {
      case "EDITORIAL":
        items.push({
          id: "contributor-editorial-upload",
          label: "How to upload editorial images",
          article: { slug: "how-to-upload-editorial-images" },
          href: buildContributorHelpArticleHref("how-to-upload-editorial-images"),
        })
        break
      case "CARICATURE":
        items.push({
          id: "contributor-caricature-upload",
          label: "How to upload caricature images",
          article: { slug: "how-to-upload-caricature-images" },
          href: buildContributorHelpArticleHref("how-to-upload-caricature-images"),
        })
        break
      default: {
        const exhaustive: never = type
        void exhaustive
      }
    }
  }

  return items
}

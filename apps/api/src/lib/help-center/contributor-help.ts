export const CONTRIBUTOR_HELP_ARTICLE_SLUGS = [
  "how-to-upload-editorial-images",
  "how-to-upload-caricature-images",
  "how-to-upload-caricatures",
] as const

export type ContributorHelpArticleSlug = (typeof CONTRIBUTOR_HELP_ARTICLE_SLUGS)[number]

export function isContributorHelpArticleSlug(slug: string): slug is ContributorHelpArticleSlug {
  return (CONTRIBUTOR_HELP_ARTICLE_SLUGS as readonly string[]).includes(slug)
}

export function isContributorVisibleHelpArticleStatus(status: string) {
  return status === "PUBLISHED" || status === "DRAFT"
}

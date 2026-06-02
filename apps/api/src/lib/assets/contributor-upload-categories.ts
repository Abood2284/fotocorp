export const CONTRIBUTOR_UPLOAD_CATEGORY_NAMES = [
  "Entertainment",
  "News",
  "Fashion",
  "Sports",
  "Business",
  "Retro",
  "Royalty Free",
] as const

export type ContributorUploadCategoryName = (typeof CONTRIBUTOR_UPLOAD_CATEGORY_NAMES)[number]

export function isContributorUploadCategoryName(name: string): name is ContributorUploadCategoryName {
  return (CONTRIBUTOR_UPLOAD_CATEGORY_NAMES as readonly string[]).includes(name)
}

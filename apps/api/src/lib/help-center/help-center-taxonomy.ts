export interface HelpCategorySeed {
  name: string
  slug: string
  description: string
  displayOrder: number
}

export interface HelpTagSeed {
  name: string
  slug: string
}

export interface HelpArticleSeed {
  title: string
  slug: string
  categorySlug: string
  summary: string
  bodyMarkdown: string
  tagSlugs: string[]
  audienceRoles: string[]
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  estimatedMinutes: number
  sortOrder: number
}

export const HELP_CATEGORY_SEEDS: HelpCategorySeed[] = [
  {
    name: "Getting Started",
    slug: "getting-started",
    description: "Orientation for new staff and common first tasks.",
    displayOrder: 10,
  },
  {
    name: "Asset Management",
    slug: "asset-management",
    description: "Upload, edit, and organize editorial assets.",
    displayOrder: 20,
  },
  {
    name: "Captions & Metadata",
    slug: "captions-metadata",
    description: "Caption writing, keywords, and metadata rules.",
    displayOrder: 30,
  },
  {
    name: "Contributor Workflow",
    slug: "contributor-workflow",
    description: "Review and approve contributor submissions.",
    displayOrder: 40,
  },
  {
    name: "Customer Access",
    slug: "customer-access",
    description: "Access inquiries, entitlements, and subscriber support.",
    displayOrder: 50,
  },
  {
    name: "Downloads & Licensing",
    slug: "downloads-licensing",
    description: "Download logs, quotas, and licensing guidance.",
    displayOrder: 60,
  },
  {
    name: "Videos",
    slug: "videos",
    description: "Video asset workflows and troubleshooting.",
    displayOrder: 70,
  },
  {
    name: "Caricatures",
    slug: "caricatures",
    description: "Caricature upload, review, and publish tasks.",
    displayOrder: 80,
  },
  {
    name: "Troubleshooting",
    slug: "troubleshooting",
    description: "Common issues and fixes across the platform.",
    displayOrder: 90,
  },
  {
    name: "Admin Settings",
    slug: "admin-settings",
    description: "Staff administration and platform configuration.",
    displayOrder: 100,
  },
]

export const HELP_TAG_SEEDS: HelpTagSeed[] = [
  { name: "upload", slug: "upload" },
  { name: "caption", slug: "caption" },
  { name: "approval", slug: "approval" },
  { name: "metadata", slug: "metadata" },
  { name: "download", slug: "download" },
  { name: "event", slug: "event" },
  { name: "contributor", slug: "contributor" },
  { name: "customer", slug: "customer" },
  { name: "license", slug: "license" },
  { name: "search", slug: "search" },
  { name: "video", slug: "video" },
  { name: "caricature", slug: "caricature" },
  { name: "staff", slug: "staff" },
  { name: "admin", slug: "admin" },
  { name: "review", slug: "review" },
  { name: "excel-import", slug: "excel-import" },
  { name: "troubleshooting", slug: "troubleshooting" },
]

export const HELP_ARTICLE_SEEDS: HelpArticleSeed[] = [
  {
    title: "How to edit an asset caption",
    slug: "how-to-edit-an-asset-caption",
    categorySlug: "captions-metadata",
    summary: "Placeholder draft for caption editing steps.",
    bodyMarkdown:
      "> **Draft placeholder** — replace with the real caption editing workflow in a follow-up PR.\n\n1. Open the asset in the staff catalog.\n2. Edit the caption field.\n3. Save changes.",
    tagSlugs: ["caption", "metadata"],
    audienceRoles: ["CAPTION_WRITER", "CATALOG_MANAGER", "SUPER_ADMIN"],
    difficulty: "BEGINNER",
    estimatedMinutes: 5,
    sortOrder: 10,
  },
  {
    title: "How to upload editorial images",
    slug: "how-to-upload-editorial-images",
    categorySlug: "asset-management",
    summary: "Placeholder draft for editorial image upload steps.",
    bodyMarkdown:
      "> **Draft placeholder** — replace with the real upload wizard guide in a follow-up PR.\n\nUse the staff upload wizard to create a batch and attach metadata per image.",
    tagSlugs: ["upload", "event"],
    audienceRoles: ["CATALOG_MANAGER", "CAPTION_WRITER", "SUPER_ADMIN"],
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 10,
    sortOrder: 10,
  },
  {
    title: "How to approve contributor uploads",
    slug: "how-to-approve-contributor-uploads",
    categorySlug: "contributor-workflow",
    summary: "Placeholder draft for contributor upload approval.",
    bodyMarkdown:
      "> **Draft placeholder** — replace with the real contributor review checklist in a follow-up PR.\n\nReview metadata, captions, and image quality before approving.",
    tagSlugs: ["approval", "contributor", "review"],
    audienceRoles: ["CAPTION_WRITER", "SUPER_ADMIN"],
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 8,
    sortOrder: 10,
  },
]

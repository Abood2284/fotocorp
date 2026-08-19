import { EmptyState } from "@/components/shared/empty-state"

export default function ContributorHelpArticleNotFound() {
  return (
    <EmptyState
      title="Help article not found"
      description="This guide may have been moved, or it is not available in the contributor portal yet."
      action={{ label: "Back to uploads", href: "/contributor/uploads" }}
    />
  )
}

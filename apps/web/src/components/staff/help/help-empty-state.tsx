import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { BookOpen } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

interface HelpEmptyStateProps {
  variant: "browse" | "no-results" | "no-published" | "no-categories" | "error"
}

const COPY: Record<
  HelpEmptyStateProps["variant"],
  { title: string; description: string; icon?: LucideIcon }
> = {
  browse: {
    title: "Search for a workflow or choose a category to get started.",
    description: "Try captions, uploads, contributor review, or customer access.",
    icon: BookOpen,
  },
  "no-results": {
    title: "No help articles found.",
    description: "Try a different search term or category.",
    icon: BookOpen,
  },
  "no-published": {
    title: "No help articles are published yet.",
    description: "Ask a manager to publish the first guide.",
    icon: BookOpen,
  },
  "no-categories": {
    title: "No help categories are available yet.",
    description: "Help taxonomy has not been seeded or configured.",
    icon: BookOpen,
  },
  error: {
    title: "Could not load help articles.",
    description: "The help service is unavailable right now.",
    icon: BookOpen,
  },
}

export function HelpEmptyState({ variant }: HelpEmptyStateProps) {
  const copy = COPY[variant]
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      action={
        variant === "error"
          ? {
              label: "Back to Help Center",
              href: "/staff/help",
            }
          : undefined
      }
    />
  )
}

export function HelpArticleNotFound() {
  return (
    <EmptyState
      title="Help article not found"
      description="This article may have been moved, archived, or restricted to another role."
      action={{ label: "Back to Help Center", href: "/staff/help" }}
    />
  )
}

export function HelpContentLoadError() {
  return (
    <div className="space-y-4">
      <HelpEmptyState variant="error" />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/staff/help" className="text-primary hover:underline">
          Return to Help Center
        </Link>
      </p>
    </div>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface HelpManageHeaderProps {
  title?: string
  description?: string
  showDefaultActions?: boolean
}

export function HelpManageHeader({
  title = "Help Content Management",
  description = "Create, update, publish, and organize internal staff guides.",
  showDefaultActions = true,
}: HelpManageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      {showDefaultActions ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/staff/help/manage/new">New article</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/help/manage/categories">Manage categories</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/help/manage/tags">Manage tags</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/help/manage/contextual-links">Manage contextual links</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/staff/help">View Help Center</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

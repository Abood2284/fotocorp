"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import type { HelpArticleListItem } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import { formatHelpDate, formatHelpDifficulty, formatHelpDuration } from "@/lib/staff/help-format"
import { formatHelpAudienceRoles } from "@/lib/staff/help-form"
import { staffHelpClientJson } from "@/lib/staff/help-client"
import { HelpStatusBadge } from "@/components/staff/help/manage/help-status-badge"

interface HelpArticleManagementListProps {
  items: HelpArticleListItem[]
}

export function HelpArticleManagementList({ items }: HelpArticleManagementListProps) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No articles match the current filters.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Title
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Audience
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Updated
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {items.map((item) => (
              <HelpArticleManagementRow key={item.id} item={item} layout="table" />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {items.map((item) => (
          <HelpArticleManagementRow key={item.id} item={item} layout="card" />
        ))}
      </div>
    </div>
  )
}

function HelpArticleManagementRow({
  item,
  layout,
}: {
  item: HelpArticleListItem
  layout: "table" | "card"
}) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const difficulty = formatHelpDifficulty(item.difficulty)
  const duration = formatHelpDuration(item.estimatedMinutes)
  const updated = formatHelpDate(item.updatedAt)
  const published = formatHelpDate(item.publishedAt)
  const audience = formatHelpAudienceRoles(item.audienceRoles ?? [])
  const canPreview = item.status !== "ARCHIVED"

  async function updateStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    setError(null)
    startTransition(async () => {
      try {
        await staffHelpClientJson(`/articles/${item.id}`, {
          method: "PATCH",
          body: { status },
        })
        toast({
          message: status === "PUBLISHED" ? "Article published." : status === "ARCHIVED" ? "Article archived." : "Article saved as draft.",
          variant: "success",
        })
        router.refresh()
      } catch (caught) {
        const message =
          caught instanceof StaffApiError ? caught.message : "Could not update article status."
        setError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href={`/staff/help/manage/${item.id}/edit`}>Edit</Link>
      </Button>
      {canPreview ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/staff/help/${item.slug}`} target="_blank" rel="noopener noreferrer">
            Preview
          </Link>
        </Button>
      ) : null}
      {item.status !== "PUBLISHED" ? (
        <Button size="sm" onClick={() => updateStatus("PUBLISHED")} disabled={isPending}>
          Publish
        </Button>
      ) : null}
      {item.status !== "ARCHIVED" ? (
        <Button size="sm" variant="secondary" onClick={() => updateStatus("ARCHIVED")} disabled={isPending}>
          Archive
        </Button>
      ) : null}
    </div>
  )

  if (layout === "card") {
    return (
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{item.category.name}</p>
            <h3 className="mt-1 font-serif text-lg font-semibold text-foreground">{item.title}</h3>
          </div>
          <HelpStatusBadge status={item.status} />
        </div>
        <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">Audience: </dt>
            <dd className="inline">{audience}</dd>
          </div>
          {item.tags.length ? (
            <div>
              <dt className="inline font-medium text-foreground">Tags: </dt>
              <dd className="inline">{item.tags.map((tag) => tag.name).join(", ")}</dd>
            </div>
          ) : null}
          {difficulty || duration ? (
            <div>
              <dt className="inline font-medium text-foreground">Meta: </dt>
              <dd className="inline">
                {[difficulty, duration].filter(Boolean).join(" · ")}
              </dd>
            </div>
          ) : null}
          {updated ? (
            <div>
              <dt className="inline font-medium text-foreground">Updated: </dt>
              <dd className="inline">{updated}</dd>
            </div>
          ) : null}
          {published ? (
            <div>
              <dt className="inline font-medium text-foreground">Published: </dt>
              <dd className="inline">{published}</dd>
            </div>
          ) : null}
        </dl>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4">{actions}</div>
      </article>
    )
  }

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{item.title}</p>
          {item.tags.length ? (
            <p className="text-xs text-muted-foreground">{item.tags.map((tag) => tag.name).join(", ")}</p>
          ) : null}
          {difficulty || duration ? (
            <p className="text-xs text-muted-foreground">
              {[difficulty, duration].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <HelpStatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">{item.category.name}</td>
      <td className="px-4 py-3 align-top text-muted-foreground">{audience}</td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        <div>{updated ?? "—"}</div>
        {published ? <div className="text-xs">Published {published}</div> : null}
      </td>
      <td className="px-4 py-3 align-top">
        {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end">{actions}</div>
      </td>
    </tr>
  )
}

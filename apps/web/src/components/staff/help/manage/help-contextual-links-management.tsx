"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HelpArticleListItem, ManageContextualHelpLink } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import { STAFF_HELP_CONTEXTS, getStaffHelpContextLabel } from "@/lib/staff/help-contexts"
import { staffHelpClientJson } from "@/lib/staff/help-client"

interface HelpContextualLinksManagementProps {
  links: ManageContextualHelpLink[]
  articles: HelpArticleListItem[]
}

const PLACEMENT_OPTIONS = ["PAGE_HEADER", "SIDEBAR_CARD", "INLINE_PANEL"] as const

interface FormState {
  contextKey: string
  articleId: string
  label: string
  description: string
  placement: (typeof PLACEMENT_OPTIONS)[number]
  displayOrder: string
  isActive: boolean
}

const emptyForm = (): FormState => ({
  contextKey: STAFF_HELP_CONTEXTS[0]?.key ?? "staff.assets.upload",
  articleId: "",
  label: "",
  description: "",
  placement: "PAGE_HEADER",
  displayOrder: "10",
  isActive: true,
})

export function HelpContextualLinksManagement({ links, articles }: HelpContextualLinksManagementProps) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [contextFilter, setContextFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [articleQuery, setArticleQuery] = useState("")
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredArticles = useMemo(() => {
    const normalized = articleQuery.trim().toLowerCase()
    if (!normalized) return articles
    return articles.filter(
      (article) =>
        article.title.toLowerCase().includes(normalized) ||
        article.slug.toLowerCase().includes(normalized),
    )
  }, [articleQuery, articles])

  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (contextFilter && link.contextKey !== contextFilter) return false
      if (statusFilter === "active" && !link.isActive) return false
      if (statusFilter === "inactive" && link.isActive) return false
      return true
    })
  }, [contextFilter, links, statusFilter])

  function startEdit(link: ManageContextualHelpLink) {
    setEditingId(link.id)
    setForm({
      contextKey: link.contextKey,
      articleId: link.article.id,
      label: link.label ?? "",
      description: link.description ?? "",
      placement: link.placement,
      displayOrder: String(link.displayOrder),
      isActive: link.isActive,
    })
    setError(null)
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  async function saveLink() {
    if (!form.articleId) {
      setError("Select an article.")
      return
    }

    const displayOrder = Number.parseInt(form.displayOrder, 10)
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      setError("Display order must be a non-negative number.")
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        const payload = {
          contextKey: form.contextKey,
          articleId: form.articleId,
          label: form.label.trim() || null,
          description: form.description.trim() || null,
          placement: form.placement,
          displayOrder,
          isActive: form.isActive,
        }

        if (editingId) {
          await staffHelpClientJson(`/manage/contextual-links/${encodeURIComponent(editingId)}`, {
            method: "PATCH",
            body: payload,
          })
          toast({ message: "Contextual link updated.", variant: "success" })
        } else {
          await staffHelpClientJson("/manage/contextual-links", {
            method: "POST",
            body: payload,
          })
          toast({ message: "Contextual link created.", variant: "success" })
        }

        resetForm()
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not save contextual link."
        setError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  async function deactivateLink(linkId: string) {
    startTransition(async () => {
      try {
        await staffHelpClientJson(`/manage/contextual-links/${encodeURIComponent(linkId)}`, {
          method: "DELETE",
        })
        toast({ message: "Contextual link deactivated.", variant: "success" })
        setPendingDeactivateId(null)
        if (editingId === linkId) resetForm()
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not deactivate link."
        toast({ message, variant: "error" })
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          {editingId ? "Edit contextual link" : "Create contextual link"}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Context</span>
            <select
              value={form.contextKey}
              onChange={(event) => setForm((current) => ({ ...current, contextKey: event.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STAFF_HELP_CONTEXTS.map((context) => (
                <option key={context.key} value={context.key}>
                  {context.label} ({context.key})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Article search</span>
            <Input
              value={articleQuery}
              onChange={(event) => setArticleQuery(event.target.value)}
              placeholder="Search articles by title or slug"
            />
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Article</span>
            <select
              value={form.articleId}
              onChange={(event) => setForm((current) => ({ ...current, articleId: event.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select an article</option>
              {filteredArticles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title} ({article.status}) — {article.slug}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Label override</span>
            <Input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Optional display label"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Display order</span>
            <Input
              value={form.displayOrder}
              onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))}
            />
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Description</span>
            <Input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional helper text"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Placement</span>
            <select
              value={form.placement}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  placement: event.target.value as FormState["placement"],
                }))
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PLACEMENT_OPTIONS.map((placement) => (
                <option key={placement} value={placement}>
                  {placement}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span className="font-medium text-foreground">Active</span>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={saveLink}>
            {editingId ? "Save changes" : "Create link"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-serif text-lg font-semibold text-foreground">Existing links</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={contextFilter}
              onChange={(event) => setContextFilter(event.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Filter by context"
            >
              <option value="">All contexts</option>
              {STAFF_HELP_CONTEXTS.map((context) => (
                <option key={context.key} value={context.key}>
                  {context.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        {!filteredLinks.length ? (
          <p className="text-sm text-muted-foreground">
            No contextual links yet. Attach a help article to a staff workflow to show relevant guidance on that page.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Context
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Article
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Label
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Placement
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{getStaffHelpContextLabel(link.contextKey)}</div>
                      <div className="text-xs text-muted-foreground">{link.contextKey}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{link.article.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {link.article.status} · {link.article.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">{link.label ?? "—"}</td>
                    <td className="px-4 py-3 align-top text-foreground">{link.placement}</td>
                    <td className="px-4 py-3 align-top text-foreground">{link.displayOrder}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          link.isActive
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {link.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(link)}>
                          Edit
                        </Button>
                        {link.isActive ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isPending}
                            onClick={() => setPendingDeactivateId(link.id)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeactivateId != null}
        title="Deactivate contextual link?"
        description="This link will stop appearing on staff workflow pages. You can reactivate it later by editing the mapping."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => {
          if (pendingDeactivateId) void deactivateLink(pendingDeactivateId)
        }}
        onCancel={() => setPendingDeactivateId(null)}
      />
    </div>
  )
}

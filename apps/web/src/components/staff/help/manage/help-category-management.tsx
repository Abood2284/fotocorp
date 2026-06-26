"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HelpCategoryManageSummary } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import { isValidHelpSlug, slugifyHelpText } from "@/lib/staff/help-form"
import { staffHelpClientJson } from "@/lib/staff/help-client"
import { Badge } from "@/components/ui/badge"

interface HelpCategoryManagementProps {
  categories: HelpCategoryManageSummary[]
}

interface CategoryFormState {
  name: string
  slug: string
  description: string
  displayOrder: string
  isActive: boolean
}

const emptyForm: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  displayOrder: "0",
  isActive: true,
}

export function HelpCategoryManagement({ categories }: HelpCategoryManagementProps) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [createForm, setCreateForm] = useState<CategoryFormState>(emptyForm)
  const [createSlugTouched, setCreateSlugTouched] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CategoryFormState>(emptyForm)
  const [editSlugTouched, setEditSlugTouched] = useState(true)
  const [editError, setEditError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(category: HelpCategoryManageSummary) {
    setEditingId(category.id)
    setEditForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      displayOrder: String(category.displayOrder),
      isActive: category.isActive,
    })
    setEditSlugTouched(true)
    setEditError(null)
  }

  async function createCategory() {
    if (!createForm.name.trim()) {
      setCreateError("Name is required.")
      return
    }
    const slug = createForm.slug.trim() || slugifyHelpText(createForm.name)
    if (!isValidHelpSlug(slug)) {
      setCreateError("Slug must use lowercase letters, numbers, and dashes only.")
      return
    }

    setCreateError(null)
    startTransition(async () => {
      try {
        await staffHelpClientJson("/categories", {
          method: "POST",
          body: {
            name: createForm.name.trim(),
            slug,
            description: createForm.description.trim() || null,
            displayOrder: Number.parseInt(createForm.displayOrder || "0", 10),
            isActive: createForm.isActive,
          },
        })
        toast({ message: "Category created.", variant: "success" })
        setCreateForm(emptyForm)
        setCreateSlugTouched(false)
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not create category."
        setCreateError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  async function saveCategory(categoryId: string) {
    if (!editForm.name.trim()) {
      setEditError("Name is required.")
      return
    }
    if (!isValidHelpSlug(editForm.slug.trim())) {
      setEditError("Slug must use lowercase letters, numbers, and dashes only.")
      return
    }

    setEditError(null)
    startTransition(async () => {
      try {
        await staffHelpClientJson(`/categories/${categoryId}`, {
          method: "PATCH",
          body: {
            name: editForm.name.trim(),
            slug: editForm.slug.trim(),
            description: editForm.description.trim() || null,
            displayOrder: Number.parseInt(editForm.displayOrder || "0", 10),
            isActive: editForm.isActive,
          },
        })
        toast({ message: "Category updated.", variant: "success" })
        setEditingId(null)
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not update category."
        setEditError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Create category</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Name</span>
            <Input
              value={createForm.name}
              onChange={(event) => {
                const name = event.target.value
                setCreateForm((current) => ({
                  ...current,
                  name,
                  slug: createSlugTouched ? current.slug : slugifyHelpText(name),
                }))
              }}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Slug</span>
            <Input
              value={createForm.slug}
              onChange={(event) => {
                setCreateSlugTouched(true)
                setCreateForm((current) => ({ ...current, slug: event.target.value }))
              }}
            />
          </label>
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Description</span>
            <textarea
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Display order</span>
            <Input
              type="number"
              min={0}
              value={createForm.displayOrder}
              onChange={(event) => setCreateForm((current) => ({ ...current, displayOrder: event.target.value }))}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(event) => setCreateForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            <span>Active</span>
          </label>
        </div>
        {createError ? <p className="mt-3 text-sm text-destructive">{createError}</p> : null}
        <div className="mt-4">
          <Button type="button" disabled={isPending} onClick={createCategory}>
            Create category
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">Existing categories</h2>
        {!categories.length ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          categories.map((category) => (
            <article key={category.id} className="rounded-lg border border-border bg-card p-5">
              {editingId === category.id ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">Name</span>
                    <Input
                      value={editForm.name}
                      onChange={(event) => {
                        const name = event.target.value
                        setEditForm((current) => ({
                          ...current,
                          name,
                          slug: editSlugTouched ? current.slug : slugifyHelpText(name),
                        }))
                      }}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">Slug</span>
                    <Input
                      value={editForm.slug}
                      onChange={(event) => {
                        setEditSlugTouched(true)
                        setEditForm((current) => ({ ...current, slug: event.target.value }))
                      }}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm md:col-span-2">
                    <span className="font-medium text-foreground">Description</span>
                    <textarea
                      value={editForm.description}
                      onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium text-foreground">Display order</span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.displayOrder}
                      onChange={(event) => setEditForm((current) => ({ ...current, displayOrder: event.target.value }))}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>Active</span>
                  </label>
                  {editError ? <p className="md:col-span-2 text-sm text-destructive">{editError}</p> : null}
                  <div className="flex gap-2 md:col-span-2">
                    <Button type="button" disabled={isPending} onClick={() => saveCategory(category.id)}>
                      Save changes
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg font-semibold text-foreground">{category.name}</h3>
                      <Badge variant={category.isActive ? "success" : "muted"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{category.slug}</p>
                    {category.description ? (
                      <p className="mt-2 text-sm text-foreground-body">{category.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {category.totalArticleCount} total · {category.articleCount} published · order {category.displayOrder}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => startEdit(category)}>
                    Edit
                  </Button>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  )
}

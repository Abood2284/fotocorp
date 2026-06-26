"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { HelpCategorySelector } from "@/components/staff/help/manage/help-category-selector"
import { HelpMarkdownEditor } from "@/components/staff/help/manage/help-markdown-editor"
import { HelpRoleSelector } from "@/components/staff/help/manage/help-role-selector"
import { HelpTagSelector } from "@/components/staff/help/manage/help-tag-selector"
import { HelpMediaManager } from "@/components/staff/help/manage/help-media-manager"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HelpArticleManageDetail, HelpCategoryManageSummary, HelpTagSummary } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import {
  buildHelpArticlePayload,
  deriveSlugFromTitle,
  validateHelpArticleForm,
  type HelpArticleFormValues,
  type HelpArticleStatus,
  type StaffHelpRole,
  HELP_ARTICLE_DIFFICULTIES,
} from "@/lib/staff/help-form"
import { staffHelpClientJson } from "@/lib/staff/help-client"

interface HelpRelatedArticleOption {
  id: string
  title: string
  slug: string
}

interface HelpArticleFormProps {
  mode: "create" | "edit"
  articleId?: string
  initialValues: HelpArticleFormValues
  categories: HelpCategoryManageSummary[]
  tags: HelpTagSummary[]
  relatedArticleOptions?: HelpRelatedArticleOption[]
  media?: HelpArticleManageDetail["media"]
}

export function HelpArticleForm({
  mode,
  articleId,
  initialValues,
  categories,
  tags,
  relatedArticleOptions = [],
  media = [],
}: HelpArticleFormProps) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [values, setValues] = useState(initialValues)
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [errors, setErrors] = useState<ReturnType<typeof validateHelpArticleForm>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateValues(patch: Partial<HelpArticleFormValues>) {
    setValues((current) => ({ ...current, ...patch }))
  }

  function handleTitleChange(title: string) {
    const nextSlug = deriveSlugFromTitle(title, values.slug, slugTouched)
    updateValues({ title, slug: nextSlug })
  }

  async function submit(status: HelpArticleStatus) {
    const nextValues = { ...values, status }
    const validationErrors = validateHelpArticleForm(nextValues)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError("Fix the highlighted fields before saving.")
      return
    }

    setSubmitError(null)
    const payload = buildHelpArticlePayload(nextValues, status)

    startTransition(async () => {
      try {
        if (mode === "create") {
          const response = await staffHelpClientJson<{ ok: true; article: { id: string } }>("/articles", {
            method: "POST",
            body: payload,
          })
          toast({ message: status === "PUBLISHED" ? "Article published." : "Draft saved.", variant: "success" })
          router.push(`/staff/help/manage/${response.article.id}/edit`)
          router.refresh()
          return
        }

        if (!articleId) throw new Error("Article id is required for edit.")

        await staffHelpClientJson(`/articles/${articleId}`, {
          method: "PATCH",
          body: payload,
        })
        toast({
          message:
            status === "PUBLISHED"
              ? "Article published."
              : status === "ARCHIVED"
                ? "Article archived."
                : "Changes saved.",
          variant: "success",
        })
        updateValues({ status })
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not save article."
        setSubmitError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  function toggleRelatedArticle(relatedId: string) {
    if (relatedId === articleId) return
    if (values.relatedArticleIds.includes(relatedId)) {
      updateValues({ relatedArticleIds: values.relatedArticleIds.filter((item) => item !== relatedId) })
      return
    }
    updateValues({ relatedArticleIds: [...values.relatedArticleIds, relatedId] })
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault()
        void submit(values.status)
      }}
    >
      {submitError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Title</span>
            <Input value={values.title} onChange={(event) => handleTitleChange(event.target.value)} aria-invalid={Boolean(errors.title)} />
            {errors.title ? <span className="text-xs text-destructive">{errors.title}</span> : null}
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Slug</span>
            <Input
              value={values.slug}
              onChange={(event) => {
                setSlugTouched(true)
                updateValues({ slug: event.target.value })
              }}
              aria-invalid={Boolean(errors.slug)}
            />
            <span className="block text-xs text-muted-foreground">Lowercase letters, numbers, and dashes only.</span>
            {errors.slug ? <span className="text-xs text-destructive">{errors.slug}</span> : null}
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Summary</span>
            <textarea
              value={values.summary}
              onChange={(event) => updateValues({ summary: event.target.value })}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.summary)}
            />
            {errors.summary ? <span className="text-xs text-destructive">{errors.summary}</span> : null}
          </label>

          <HelpCategorySelector
            categories={categories}
            value={values.categoryId}
            onChange={(categoryId) => updateValues({ categoryId })}
            error={errors.categoryId}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Content</h2>
        <HelpMarkdownEditor
          value={values.bodyMarkdown}
          onChange={(bodyMarkdown) => updateValues({ bodyMarkdown })}
          error={errors.bodyMarkdown}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Discovery</h2>
        <HelpTagSelector tags={tags} value={values.tagIds} onChange={(tagIds) => updateValues({ tagIds })} />

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Difficulty</span>
            <select
              value={values.difficulty}
              onChange={(event) =>
                updateValues({ difficulty: event.target.value as HelpArticleFormValues["difficulty"] })
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {HELP_ARTICLE_DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0) + item.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Estimated minutes</span>
            <Input
              type="number"
              min={1}
              max={240}
              value={values.estimatedMinutes}
              onChange={(event) => updateValues({ estimatedMinutes: event.target.value })}
              aria-invalid={Boolean(errors.estimatedMinutes)}
            />
            {errors.estimatedMinutes ? (
              <span className="text-xs text-destructive">{errors.estimatedMinutes}</span>
            ) : null}
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Sort order</span>
            <Input
              type="number"
              min={0}
              value={values.sortOrder}
              onChange={(event) => updateValues({ sortOrder: event.target.value })}
              aria-invalid={Boolean(errors.sortOrder)}
            />
            {errors.sortOrder ? <span className="text-xs text-destructive">{errors.sortOrder}</span> : null}
          </label>
        </div>

        {relatedArticleOptions.length ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Related articles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {relatedArticleOptions
                .filter((item) => item.id !== articleId)
                .map((item) => (
                  <label
                    key={item.id}
                    className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={values.relatedArticleIds.includes(item.id)}
                      onChange={() => toggleRelatedArticle(item.id)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <span>{item.title}</span>
                  </label>
                ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Audience</h2>
        <HelpRoleSelector
          value={values.audienceRoles}
          onChange={(audienceRoles) => updateValues({ audienceRoles: audienceRoles as StaffHelpRole[] })}
          error={errors.audienceRoles}
        />
      </section>

      {mode === "edit" && articleId ? (
        <HelpMediaManager articleId={articleId} initialItems={media} />
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Publishing</h2>
        <label className="block max-w-xs space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            value={values.status}
            onChange={(event) => updateValues({ status: event.target.value as HelpArticleStatus })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => submit("DRAFT")}>
            {mode === "create" ? "Save draft" : "Save changes"}
          </Button>
          <Button type="button" disabled={isPending} onClick={() => submit("PUBLISHED")}>
            Publish
          </Button>
          {mode === "edit" ? (
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => submit("ARCHIVED")}>
              Archive
            </Button>
          ) : null}
          {mode === "edit" && values.slug ? (
            <Button asChild type="button" variant="ghost">
              <Link href={`/staff/help/${values.slug}`} target="_blank" rel="noopener noreferrer">
                Preview
              </Link>
            </Button>
          ) : null}
          <Button asChild type="button" variant="ghost">
            <Link href="/staff/help/manage">Cancel</Link>
          </Button>
        </div>
      </section>
    </form>
  )
}

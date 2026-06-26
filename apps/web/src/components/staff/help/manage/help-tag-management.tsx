"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HelpTagSummary } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import { isValidHelpSlug, slugifyHelpText } from "@/lib/staff/help-form"
import { staffHelpClientJson } from "@/lib/staff/help-client"

interface HelpTagManagementProps {
  tags: HelpTagSummary[]
}

export function HelpTagManagement({ tags }: HelpTagManagementProps) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredTags = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tags
    return tags.filter(
      (tag) => tag.name.toLowerCase().includes(normalized) || tag.slug.toLowerCase().includes(normalized),
    )
  }, [query, tags])

  async function createTag() {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    const nextSlug = slug.trim() || slugifyHelpText(name)
    if (!isValidHelpSlug(nextSlug)) {
      setError("Slug must use lowercase letters, numbers, and dashes only.")
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await staffHelpClientJson("/tags", {
          method: "POST",
          body: { name: name.trim(), slug: nextSlug },
        })
        toast({ message: "Tag created.", variant: "success" })
        setName("")
        setSlug("")
        setSlugTouched(false)
        router.refresh()
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not create tag."
        setError(message)
        toast({ message, variant: "error" })
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Create tag</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Name</span>
            <Input
              value={name}
              onChange={(event) => {
                const nextName = event.target.value
                setName(nextName)
                if (!slugTouched) setSlug(slugifyHelpText(nextName))
              }}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Slug</span>
            <Input
              value={slug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
            />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4">
          <Button type="button" disabled={isPending} onClick={createTag}>
            Create tag
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-lg font-semibold text-foreground">Existing tags</h2>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tags"
            aria-label="Search tags"
            className="max-w-sm"
          />
        </div>

        {!filteredTags.length ? (
          <p className="text-sm text-muted-foreground">No tags match the current search.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Slug
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredTags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="px-4 py-3 text-foreground">{tag.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tag.slug}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

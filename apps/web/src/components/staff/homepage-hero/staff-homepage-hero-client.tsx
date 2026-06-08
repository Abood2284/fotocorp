"use client"

import { ArrowDown, ArrowUp, Loader2, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PreviewImage } from "@/components/assets/preview-image"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { useToast } from "@/components/staff/shared/toast"
import { StaffHomepageHeroCandidateSearch } from "@/components/staff/homepage-hero/staff-homepage-hero-candidate-search"
import {
  HOMEPAGE_HERO_POOL_SIZE,
  type HomepageHeroPoolCandidate,
  type HomepageHeroPoolItem,
  type HomepageHeroPoolResponse,
} from "@/features/homepage-hero/types"
import { saveHomepageHeroPoolAction } from "@/app/(staff)/staff/(workspace)/homepage-hero/actions"

interface StaffHomepageHeroClientProps {
  initialPool: HomepageHeroPoolResponse
}

interface DraftItem {
  assetId: string
  title: string
  fotokey: string | null
  eventName: string | null
}

export function StaffHomepageHeroClient({ initialPool }: StaffHomepageHeroClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftItems, setDraftItems] = useState<DraftItem[]>(() => mapInitialDraft(initialPool.items))
  const [savedAt, setSavedAt] = useState<string | null>(initialPool.updatedAt)
  const [confirmSave, setConfirmSave] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraftItems(mapInitialDraft(initialPool.items))
    setSavedAt(initialPool.updatedAt)
  }, [initialPool])

  const isDirty = useMemo(() => {
    const initialIds = initialPool.items.map((item) => item.assetId).join("|")
    const draftIds = draftItems.map((item) => item.assetId).join("|")
    return initialIds !== draftIds
  }, [draftItems, initialPool.items])

  const canSave = draftItems.length === HOMEPAGE_HERO_POOL_SIZE && isDirty
  const poolFull = draftItems.length >= HOMEPAGE_HERO_POOL_SIZE
  const selectedIds = useMemo(() => new Set(draftItems.map((item) => item.assetId)), [draftItems])

  function addCandidate(candidate: HomepageHeroPoolCandidate) {
    if (poolFull || selectedIds.has(candidate.assetId)) return
    setDraftItems((current) => [
      ...current,
      {
        assetId: candidate.assetId,
        title: candidate.title,
        fotokey: candidate.fotokey,
        eventName: candidate.eventName,
      },
    ])
  }

  function removeAt(index: number) {
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= draftItems.length) return
    setDraftItems((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      if (!item) return current
      next.splice(target, 0, item)
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      setErrorMessage(null)
      try {
        const response = await saveHomepageHeroPoolAction(draftItems.map((item) => item.assetId))
        setDraftItems(mapInitialDraft(response.items))
        setSavedAt(response.updatedAt)
        toast({ message: "Homepage hero pool saved.", variant: "success" })
        setConfirmSave(false)
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save homepage hero pool."
        setErrorMessage(message)
        toast({ message, variant: "error" })
      }
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmSave}
        title="Save homepage hero pool"
        description={`Replace the live homepage hero pool with these ${HOMEPAGE_HERO_POOL_SIZE} images? The homepage will immediately show a random 9 from this pool on each visit.`}
        onConfirm={handleSave}
        onCancel={() => setConfirmSave(false)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Homepage Hero</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The homepage hero pool must contain exactly {HOMEPAGE_HERO_POOL_SIZE} public-ready images. Save goes live immediately — the homepage backdrop shows a random 9 from this pool on each page load. Remove images to swap them, then add replacements before saving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {draftItems.length}/{HOMEPAGE_HERO_POOL_SIZE} selected
          </span>
          <button
            type="button"
            disabled={!canSave || isPending}
            onClick={() => setConfirmSave(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Save pool
          </button>
        </div>
      </div>

      {savedAt ? (
        <p className="text-xs text-muted-foreground">Last saved {formatTimestamp(savedAt)}.</p>
      ) : null}

      {draftItems.length > 0 && draftItems.length < HOMEPAGE_HERO_POOL_SIZE ? (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have {draftItems.length} of {HOMEPAGE_HERO_POOL_SIZE} images selected. Add {HOMEPAGE_HERO_POOL_SIZE - draftItems.length} more before you can save — the pool cannot go live with fewer than {HOMEPAGE_HERO_POOL_SIZE}.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Selected pool</h3>
          {isDirty ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : null}
        </div>

        {draftItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            No images selected yet. Search below and add {HOMEPAGE_HERO_POOL_SIZE} public-ready images.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {draftItems.map((item, index) => (
              <PoolCard
                key={item.assetId}
                index={index}
                item={item}
                total={draftItems.length}
                onMoveDown={() => moveItem(index, 1)}
                onMoveUp={() => moveItem(index, -1)}
                onRemove={() => removeAt(index)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add images</h3>
          <p className="mt-1 text-sm text-muted-foreground">Only public-ready images with CARD previews can be added.</p>
        </div>

        <StaffHomepageHeroCandidateSearch
          selectedIds={selectedIds}
          poolFull={poolFull}
          disabled={isPending}
          onAdd={addCandidate}
        />
      </section>
    </div>
  )
}

function PoolCard({
  index,
  item,
  total,
  onMoveDown,
  onMoveUp,
  onRemove,
}: {
  index: number
  item: DraftItem
  total: number
  onMoveDown: () => void
  onMoveUp: () => void
  onRemove: () => void
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative flex min-h-[160px] items-center justify-center bg-muted p-2">
        <PreviewImage
          src={`/staff/catalog/${item.assetId}/preview-image?variant=card`}
          alt={item.title}
          className="block max-h-[280px] w-full object-contain"
        />
        <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          #{index + 1}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-sm font-medium" title={item.title}>{item.title}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{item.fotokey ?? item.assetId.slice(0, 8)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <IconButton label="Move up" disabled={index === 0} onClick={onMoveUp}>
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton label="Move down" disabled={index === total - 1} onClick={onMoveDown}>
              <ArrowDown className="h-4 w-4" />
            </IconButton>
          </div>
          <IconButton label="Remove" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </IconButton>
        </div>
      </div>
    </article>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function mapInitialDraft(items: HomepageHeroPoolItem[]): DraftItem[] {
  return items
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      assetId: item.assetId,
      title: item.title,
      fotokey: item.fotokey,
      eventName: item.eventName,
    }))
}

function formatTimestamp(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

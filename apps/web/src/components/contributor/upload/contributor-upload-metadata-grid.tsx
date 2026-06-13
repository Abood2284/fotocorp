"use client"

import { AlertTriangle, Check, Loader2, type LucideIcon } from "lucide-react"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { getTrackedDisplayName } from "@/lib/upload-wizard-resume"
import { cn } from "@/lib/utils"

interface MetadataGridPanelProps {
  items: TrackedFile[]
  selectedKey: string | null
  onSelect: (key: string) => void
  hasAnyMetadata: Set<string>
}

export function MetadataGridPanel({ items, selectedKey, onSelect, hasAnyMetadata }: MetadataGridPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8">
        <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
      </div>
    )
  }

  return (
    <div className="max-h-[calc(100vh-340px)] overflow-y-auto rounded-2xl border border-border bg-card p-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <MetadataThumbnail
            key={item.key}
            row={item}
            isSelected={item.key === selectedKey}
            hasMetadata={hasAnyMetadata.has(item.key)}
            onSelect={() => onSelect(item.key)}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inline thumbnail sub-component                                      */
/* ------------------------------------------------------------------ */

interface MetadataThumbnailProps {
  row: TrackedFile
  isSelected: boolean
  hasMetadata: boolean
  onSelect: () => void
}

function MetadataThumbnail({ row, isSelected, hasMetadata, onSelect }: MetadataThumbnailProps) {
  const status = resolveThumbnailStatus(row, hasMetadata)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40",
      )}
      aria-selected={isSelected}
      role="option"
    >
      {/* Preview image */}
      {row.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.previewUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          No preview
        </div>
      )}

      {/* Status dot — top-right corner */}
      <div className="absolute right-1 top-1">
        <ThumbnailStatusIndicator status={status} />
      </div>

      {/* Filename overlay — bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-1.5 pb-1 pt-4">
        <span className="block truncate text-[10px] leading-tight text-white/90">
          {getTrackedDisplayName(row)}
        </span>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */

type ThumbnailStatus = "saving" | "saved" | "error" | "empty"

function resolveThumbnailStatus(row: TrackedFile, hasMetadata: boolean): ThumbnailStatus {
  if (row.saveState === "saving") return "saving"
  if (row.saveState === "error") return "error"
  if (hasMetadata) return "saved"
  return "empty"
}

function ThumbnailStatusIndicator({ status }: { status: ThumbnailStatus }) {
  const config: Record<ThumbnailStatus, { Icon: LucideIcon | null; bg: string; iconColor: string; label: string }> = {
    saving: {
      Icon: null,
      bg: "bg-black/50 backdrop-blur-sm",
      iconColor: "text-white",
      label: "Saving…",
    },
    saved: {
      Icon: Check,
      bg: "bg-emerald-500/90",
      iconColor: "text-white",
      label: "Saved",
    },
    error: {
      Icon: AlertTriangle,
      bg: "bg-destructive/90",
      iconColor: "text-white",
      label: "Save error",
    },
    empty: {
      Icon: null,
      bg: "bg-black/30",
      iconColor: "text-white/70",
      label: "No metadata",
    },
  }

  const { Icon, bg, iconColor } = config[status]

  return (
    <span
      className={cn(
        "inline-flex  items-center justify-center rounded-full p-0.5 shadow-sm",
        bg,
        !Icon && "size-2",
        Icon && "size-4",
      )}
      title={config[status].label}
    >
      {Icon ? (
        <Icon size={10} className={iconColor} />
      ) : status === "saving" ? (
        <Loader2 size={10} className="animate-spin text-white" />
      ) : null}
    </span>
  )
}

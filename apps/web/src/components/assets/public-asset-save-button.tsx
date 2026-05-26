"use client"

import { Loader2, Minus, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import type React from "react"

import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { getAnonSavedAssetIds, getAnonBoards, removeFromAnonBoard } from "@/lib/storage/fotobox-anon-store"
import { FotoboxBoardPicker } from "@/components/assets/fotobox-board-picker"

interface PublicAssetSaveButtonProps {
  assetId: string
  compact?: boolean
  compactLabel?: string
  assetTitle?: string
}

export function PublicAssetSaveButton({
  assetId,
  compact = false,
  compactLabel = "Save as",
  assetTitle,
}: PublicAssetSaveButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const [hasSaved, setHasSaved] = useState(false)
  const [checking, setChecking] = useState(true)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    async function checkSaved() {
      try {
        if (isAuthenticated) {
          const res = await fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
          if (res.ok) {
            const data = (await res.json()) as { ok: boolean; boardIds?: string[] }
            setHasSaved(data.ok && (data.boardIds ?? []).length > 0)
          }
        } else {
          const ids = getAnonSavedAssetIds()
          setHasSaved(ids.includes(assetId))
        }
      } catch {
        // ignore
      } finally {
        setChecking(false)
      }
    }
    checkSaved()
  }, [assetId, isAuthenticated])

  async function handleRemove(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setRemoving(true)
    try {
      if (isAuthenticated) {
        // Get board IDs containing this asset, then remove from each
        const res = await fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; boardIds?: string[] }
          const boardIds = data.boardIds ?? []
          await Promise.all(boardIds.map((bid) =>
            fetch(`/api/fotobox/${assetId}?boardId=${bid}`, { method: "DELETE", credentials: "include" }),
          ))
        }
      } else {
        const boards = getAnonBoards()
        for (const b of boards) {
          removeFromAnonBoard(b.id, assetId)
        }
      }
      setHasSaved(false)
    } catch {
      // ignore
    } finally {
      setRemoving(false)
    }
  }

  function handleSaveClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setPickerOpen(true)
  }

  function handlePickerClose(open: boolean) {
    setPickerOpen(open)
    if (!open) {
      if (isAuthenticated) {
        fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => {
            const data = d as { ok: boolean; boardIds?: string[] }
            setHasSaved(data.ok && (data.boardIds?.length ?? 0) > 0)
          })
          .catch(() => {})
      } else {
        setHasSaved(getAnonSavedAssetIds().includes(assetId))
      }
    }
  }

  if (checking) {
    return (
      <button
        type="button"
        disabled
        className={cn("flex items-center justify-center gap-1.5 bg-black/40 text-sm text-white/60 backdrop-blur-md", compact ? "h-8 rounded-sm px-2.5" : "h-10 px-3")}
        aria-label="Checking save status"
      >
        <Loader2 className="animate-spin" size={16} />
      </button>
    )
  }

  if (hasSaved) {
    return (
      <>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          className={cn(
            "flex items-center justify-center gap-1.5 bg-black/40 text-sm font-bold text-white/80 backdrop-blur-md transition-colors hover:bg-black/60",
            compact ? "h-8 rounded-sm px-2.5" : "h-10 px-3",
          )}
          aria-label="Remove from Fotobox"
        >
          {removing ? <Loader2 className="animate-spin" size={16} /> : !compact && <Minus strokeWidth={2.5} size={16} />}
          <span>Remove</span>
          {compact && (removing ? <Loader2 className="animate-spin" size={16} /> : <Minus strokeWidth={2.5} size={16} />)}
        </button>
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSaveClick}
        className={cn(
          "flex items-center justify-center gap-1.5 bg-black/65 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/80",
          compact ? "h-8 rounded-sm px-2.5" : "h-10 px-3",
        )}
        aria-label="Save to Fotobox"
      >
        {!compact && <Plus strokeWidth={2.5} size={16} />}
        <span>{compactLabel}</span>
        {compact && <Plus strokeWidth={2.5} size={16} />}
      </button>
      <FotoboxBoardPicker
        assetId={assetId}
        open={pickerOpen}
        onOpenChange={handlePickerClose}
        assetTitle={assetTitle}
      />
    </>
  )
}

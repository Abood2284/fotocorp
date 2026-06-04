"use client"

import { Loader2, Minus, Plus } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type React from "react"

import { FotoboxBoardPicker } from "@/components/assets/fotobox-board-picker"
import { buildFotoboxAuthPathname } from "@/lib/fotobox-auth-gate"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"
import { cn } from "@/lib/utils"

interface PublicAssetSaveButtonProps {
  assetId: string
  compact?: boolean
  compactLabel?: string
  assetTitle?: string
  /** Grid tiles: avoid per-card saved-state lookups on page load. */
  skipInitialSavedCheck?: boolean
}

export function PublicAssetSaveButton({
  assetId,
  compact = false,
  compactLabel = "Save as",
  assetTitle,
  skipInitialSavedCheck = false,
}: PublicAssetSaveButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: session, isPending: authPending } = useSharedAuthSession()
  const isAuthenticated = session?.kind === "user" && Boolean(session.user)
  const [hasMounted, setHasMounted] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [checking, setChecking] = useState(() => !skipInitialSavedCheck)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const authLoading = hasMounted && authPending

  useEffect(() => {
    async function checkSaved() {
      if (!isAuthenticated || skipInitialSavedCheck) {
        setHasSaved(false)
        setChecking(false)
        return
      }

      try {
        const res = await fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; boardIds?: string[] }
          setHasSaved(data.ok && (data.boardIds ?? []).length > 0)
        }
      } catch {
        // ignore
      } finally {
        setChecking(false)
      }
    }
    checkSaved()
  }, [assetId, isAuthenticated, skipInitialSavedCheck])

  function openAuthGate() {
    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : ""
    router.push(buildFotoboxAuthPathname(pathname, search))
  }

  async function handleRemove(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!isAuthenticated) {
      openAuthGate()
      return
    }

    setRemoving(true)
    try {
      const res = await fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; boardIds?: string[] }
        const boardIds = data.boardIds ?? []
        await Promise.all(boardIds.map((bid) =>
          fetch(`/api/fotobox/${assetId}?boardId=${bid}`, { method: "DELETE", credentials: "include" }),
        ))
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
    if (authLoading) return
    if (!isAuthenticated) {
      openAuthGate()
      return
    }
    setPickerOpen(true)
  }

  function handlePickerClose(open: boolean) {
    setPickerOpen(open)
    if (!open && isAuthenticated) {
      fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const data = d as { ok: boolean; boardIds?: string[] }
          setHasSaved(data.ok && (data.boardIds?.length ?? 0) > 0)
        })
        .catch(() => {})
    }
  }

  if (checking || authLoading) {
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
      {isAuthenticated ? (
        <FotoboxBoardPicker
          assetId={assetId}
          open={pickerOpen}
          onOpenChange={handlePickerClose}
          assetTitle={assetTitle}
        />
      ) : null}
    </>
  )
}

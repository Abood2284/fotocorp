"use client"

import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { PreviewImage } from "@/components/assets/preview-image"
import { formatDate } from "@/components/assets/public-asset-card"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"
import { cn } from "@/lib/utils"
import {
  type AnonBoard,
  getAnonBoards,
  createAnonBoard,
  removeFromAnonBoard,
  deleteAnonBoard,
  renameAnonBoard,
} from "@/lib/storage/fotobox-anon-store"
import type { FotoboxBoard as ServerBoard } from "@/lib/api/account-api"

interface FotoboxClientPageProps {
  initialServerBoards: ServerBoard[]
  isSubscriber: boolean
}

export function FotoboxClientPage({ initialServerBoards, isSubscriber }: FotoboxClientPageProps) {
  const router = useRouter()
  const { data: session } = useSharedAuthSession()
  const isAuthenticated = !!session?.user
  const [serverBoards, setServerBoards] = useState<ServerBoard[]>(initialServerBoards)
  const [anonBoards, setAnonBoards] = useState<AnonBoard[]>(getAnonBoards())
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [items, setItems] = useState<Array<{ assetId: string; previewUrl?: { url: string; width: number; height: number } | null; thumbUrl?: { url: string; width: number; height: number } | null; headline?: string | null; whoIsInPicture?: string | null; caption?: string | null; fotokey?: string | null; savedAt?: string | null }>>([])
  const [newBoardName, setNewBoardName] = useState("")
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editBoardName, setEditBoardName] = useState("")
  const [boardMenuOpen, setBoardMenuOpen] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const boards = isAuthenticated ? serverBoards : anonBoards

  useEffect(() => {
    if (isAuthenticated && serverBoards.length > 0 && !activeBoardId) {
      setActiveBoardId(serverBoards[0].id)
    } else if (!isAuthenticated && anonBoards.length > 0 && !activeBoardId) {
      setActiveBoardId(anonBoards[0].id)
    }
  }, [])

  useEffect(() => {
    if (activeBoardId) {
      isAuthenticated ? loadServerItems(activeBoardId) : loadAnonItems(activeBoardId)
    }
  }, [activeBoardId, isAuthenticated])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setBoardMenuOpen(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function loadServerItems(boardId: string) {
    setLoadingItems(true)
    try {
      const params = new URLSearchParams({ boardId })
      const res = await fetch(`/api/fotobox?${params.toString()}`, { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as { items: Array<{ assetId: string; previewUrl?: { url: string; width: number; height: number } | null; thumbUrl?: { url: string; width: number; height: number } | null; headline?: string | null; whoIsInPicture?: string | null; caption?: string | null; fotokey?: string | null; savedAt?: string | null }> }
        setItems(data.items ?? [])
      }
    } finally {
      setLoadingItems(false)
    }
  }

  function loadAnonItems(boardId: string) {
    const brds = getAnonBoards()
    const board = brds.find((b) => b.id === boardId)
    setItems((board?.items ?? []).map((id) => ({
      assetId: id,
      previewUrl: { url: `/api/media/assets/${encodeURIComponent(id)}/preview/card`, width: 400, height: 300 },
    })))
  }

  async function removeItem(assetId: string) {
    if (isAuthenticated && activeBoardId) {
      const url = `/api/fotobox/${encodeURIComponent(assetId)}?boardId=${encodeURIComponent(activeBoardId)}`
      const res = await fetch(url, { method: "DELETE" }).catch(() => null)
      if (res?.ok) setItems((prev) => prev.filter((i) => i.assetId !== assetId))
    } else if (activeBoardId) {
      removeFromAnonBoard(activeBoardId, assetId)
      setAnonBoards(getAnonBoards())
      loadAnonItems(activeBoardId)
    }
  }

  async function createBoard() {
    const name = newBoardName.trim()
    if (!name) return
    setCreatingBoard(true)
    try {
      if (isAuthenticated) {
        const res = await fetch("/api/fotobox/boards", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }), credentials: "include",
        })
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; board?: ServerBoard }
          const board = data.board
          if (data.ok && board) {
            setServerBoards((prev) => [...prev, board])
            setNewBoardName("")
          }
        }
      } else {
        createAnonBoard(name)
        setAnonBoards(getAnonBoards())
        setNewBoardName("")
      }
    } finally {
      setCreatingBoard(false)
    }
  }

  async function renameBoard(boardId: string) {
    const name = editBoardName.trim()
    if (!name) { setEditingBoardId(null); return }
    try {
      if (isAuthenticated) {
        await fetch(`/api/fotobox/boards/${encodeURIComponent(boardId)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }), credentials: "include",
        })
        setServerBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)))
      } else {
        renameAnonBoard(boardId, name)
        setAnonBoards(getAnonBoards())
      }
    } finally {
      setEditingBoardId(null)
    }
  }

  async function deleteBoard(boardId: string) {
    setBoardMenuOpen(null)
    if (isAuthenticated) {
      await fetch(`/api/fotobox/boards/${encodeURIComponent(boardId)}`, {
        method: "DELETE", credentials: "include",
      })
      setServerBoards((prev) => prev.filter((b) => b.id !== boardId))
    } else {
      deleteAnonBoard(boardId)
      setAnonBoards(getAnonBoards())
    }
    if (activeBoardId === boardId) {
      const remaining = boards.filter((b) => b.id !== boardId)
      setActiveBoardId(remaining[0]?.id ?? null)
      setItems([])
    }
  }

  function openShare() {
    setShareCopied(false)
    setShareOpen(true)
    setTimeout(() => shareInputRef.current?.select(), 100)
  }

  function copyShareLink() {
    if (shareInputRef.current) {
      shareInputRef.current.select()
      navigator.clipboard.writeText(shareInputRef.current.value)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/fotobox` : "/fotobox"

  const activeBoard = isAuthenticated
    ? serverBoards.find((b) => b.id === activeBoardId)
    : anonBoards.find((b) => b.id === activeBoardId)

  const activeBoardInfo = activeBoard
    ? isAuthenticated
      ? { name: (activeBoard as ServerBoard).name, count: (activeBoard as ServerBoard).itemCount, owner: session?.user?.name || session?.user?.email || "You" }
      : { name: (activeBoard as AnonBoard).name, count: (activeBoard as AnonBoard).items.length, owner: "Anonymous" }
    : null

  return (
    <div>
      {!isAuthenticated && (
        <div className="border-b border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <Link href="/" aria-label="Fotocorp home">
              <Image
                src="/images/fotocorp-logo.svg"
                alt="Fotocorp"
                width={140}
                height={42}
                className="h-6 w-auto sm:h-7"
              />
            </Link>
            <Link href="/sign-in" className="text-sm font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {isAuthenticated ? "Account" : "Fotobox"}
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                My Fotobox
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {isAuthenticated
                  ? "Organize saved images into boards, then return here to review or download."
                  : "Save images to boards while browsing. Your boards are saved on this device."}
              </p>
            </div>
            {!isAuthenticated && (
              <Link
                href="/sign-in"
                className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in to save across devices
              </Link>
            )}
          </div>
        </header>

        <div className="flex gap-6 py-8">
          <aside className="w-[280px] shrink-0">
            <div className="sticky top-24 space-y-1">
              {/* Board list */}
              {boards.map((board: ServerBoard | AnonBoard) => {
                const boardId = isAuthenticated ? (board as ServerBoard).id : (board as AnonBoard).id
                const boardName = isAuthenticated ? (board as ServerBoard).name : (board as AnonBoard).name
                const itemCount = isAuthenticated ? (board as ServerBoard).itemCount : (board as AnonBoard).items.length
                const isActive = activeBoardId === boardId

                return (
                  <div key={boardId} className="group relative">
                    {editingBoardId === boardId ? (
                      <div className="flex items-center gap-1 p-1">
                        <input
                          type="text"
                          value={editBoardName}
                          onChange={(e) => setEditBoardName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameBoard(boardId)
                            if (e.key === "Escape") setEditingBoardId(null)
                          }}
                          onBlur={() => renameBoard(boardId)}
                          maxLength={100}
                          className="h-7 flex-1 rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-blue-400"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveBoardId(boardId)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="truncate text-sm">{boardName}</span>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-medium">{itemCount}</span> item{itemCount !== 1 ? "s" : ""} ·{" "}
                          {isActive && activeBoardInfo ? activeBoardInfo.owner : isAuthenticated ? (session?.user?.name || "You") : "Anonymous"}
                        </div>
                        {isActive && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              openShare()
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openShare() } }}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <Share2 size={11} />
                            Share
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setBoardMenuOpen(boardMenuOpen === boardId ? null : boardId)
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBoardMenuOpen(boardMenuOpen === boardId ? null : boardId) } }}
                          className="absolute right-2 top-2.5 ml-1 rounded p-1 hover:bg-blue-100 cursor-pointer group-hover:visible invisible"
                        >
                          <MoreHorizontal size={14} />
                        </span>
                      </button>
                    )}
                    {boardMenuOpen === boardId && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full z-40 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => { setEditingBoardId(boardId); setEditBoardName(boardName); setBoardMenuOpen(null) }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                        >
                          <Pencil size={14} />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBoard(boardId)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createBoard() }}
                  placeholder="New board"
                  maxLength={100}
                  className="h-7 flex-1 rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={createBoard}
                  disabled={creatingBoard || !newBoardName.trim()}
                  className="flex h-7 w-7 items-center justify-center rounded-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingBoard ? <Loader2 className="animate-spin" size={14} /> : <FolderPlus size={14} />}
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item: any) => {
                  const preview = item.previewUrl ?? item.thumbUrl
                  const title = item.headline || item.whoIsInPicture || item.caption || "Fotocorp archive image"
                  return (
                    <article key={item.assetId} className="overflow-hidden rounded-xl border border-border bg-background">
                      <Link href={`/assets/${item.assetId}`} className="group block aspect-[4/3] overflow-hidden bg-muted">
                        {preview ? (
                          <PreviewImage
                            src={preview.url}
                            alt={title}
                            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.025]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Preview unavailable
                          </div>
                        )}
                      </Link>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{item.savedAt ? `Saved ${formatDate(item.savedAt)}` : "Saved"}</span>
                          {item.fotokey && <span className="truncate">{item.fotokey}</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Link
                            href={`/assets/${item.assetId}`}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            <Eye size={14} />
                            View
                          </Link>
                          {isSubscriber ? (
                            <a
                              href={`/api/assets/${item.assetId}/download?size=large`}
                              className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <Download size={14} />
                              Large
                            </a>
                          ) : (
                            <Link
                              href="/account/subscription"
                              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                            >
                              <Download size={14} />
                              Locked
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => removeItem(item.assetId)}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <section className="rounded-2xl border border-border bg-muted/25 p-8 text-center">
                <h2 className="text-xl font-semibold text-foreground">
                  {boards.length === 0 ? "Your Fotobox is empty" : activeBoardInfo ? `"${activeBoardInfo.name}" is empty` : "Select a board"}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {boards.length === 0 ? "Create a board and save images from search to it." : "Save images from search to this board."}
                </p>
                <div className="mt-5">
                  <Link
                    href="/search"
                    className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Browse archive
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Share dialog */}
      {shareOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setShareOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Share board</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Anyone with this link can view the Fotobox page. Boards saved anonymously won&apos;t be visible to others.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={shareInputRef}
                type="text"
                readOnly
                value={shareUrl}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
              />
              <button
                type="button"
                onClick={copyShareLink}
                className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                {shareCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

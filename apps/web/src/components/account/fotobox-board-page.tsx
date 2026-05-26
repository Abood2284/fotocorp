"use client"

import {
  Download,
  Eye,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { PreviewImage } from "@/components/assets/preview-image"
import type { FotoboxItem, FotoboxBoard } from "@/lib/api/account-api"
import { formatDate } from "@/components/assets/public-asset-card"
import { cn } from "@/lib/utils"

interface FotoboxBoardPageProps {
  initialBoards: FotoboxBoard[]
  isSubscriber: boolean
}

export function FotoboxBoardPage({ initialBoards, isSubscriber }: FotoboxBoardPageProps) {
  const router = useRouter()
  const [boards, setBoards] = useState<FotoboxBoard[]>(initialBoards)
  const [activeBoardId, setActiveBoardId] = useState<string | null>(boards[0]?.id ?? null)
  const [items, setItems] = useState<FotoboxItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editBoardName, setEditBoardName] = useState("")
  const [removing, setRemoving] = useState<string | null>(null)
  const [boardMenuOpen, setBoardMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeBoardId) {
      loadItems(activeBoardId)
    } else {
      loadItems()
    }
  }, [activeBoardId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setBoardMenuOpen(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function loadItems(boardId?: string) {
    setLoadingItems(true)
    try {
      const params = new URLSearchParams()
      if (boardId) params.set("boardId", boardId)
      const res = await fetch(`/api/fotobox?${params.toString()}`, { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as { items?: FotoboxItem[] }
        setItems(data.items ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingItems(false)
    }
  }

  async function remove(assetId: string) {
    setRemoving(assetId)
    const boardId = activeBoardId
    const url = boardId
      ? `/api/fotobox/${encodeURIComponent(assetId)}?boardId=${encodeURIComponent(boardId)}`
      : `/api/fotobox/${encodeURIComponent(assetId)}`
    const res = await fetch(url, { method: "DELETE" }).catch(() => null)
    setRemoving(null)
    if (res?.ok) {
      setItems((prev) => prev.filter((i) => i.assetId !== assetId))
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, itemCount: Math.max(0, b.itemCount - 1) } : b)),
      )
    }
  }

  async function createBoard() {
    const name = newBoardName.trim()
    if (!name) return
    setCreatingBoard(true)
    try {
      const res = await fetch("/api/fotobox/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      })
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; board?: FotoboxBoard }
        const board = data.board
        if (data.ok && board) {
          setBoards((prev) => [...prev, board])
          setNewBoardName("")
        }
      }
    } finally {
      setCreatingBoard(false)
    }
  }

  async function startRename(boardId: string, currentName: string) {
    setEditingBoardId(boardId)
    setEditBoardName(currentName)
    setBoardMenuOpen(null)
  }

  async function confirmRename(boardId: string) {
    const name = editBoardName.trim()
    if (!name || name === boards.find((b) => b.id === boardId)?.name) {
      setEditingBoardId(null)
      return
    }
    try {
      const res = await fetch(`/api/fotobox/boards/${encodeURIComponent(boardId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      })
      if (res.ok) {
        setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)))
      }
    } finally {
      setEditingBoardId(null)
    }
  }

  async function deleteBoard(boardId: string) {
    setBoardMenuOpen(null)
    try {
      const res = await fetch(`/api/fotobox/boards/${encodeURIComponent(boardId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        setBoards((prev) => prev.filter((b) => b.id !== boardId))
        if (activeBoardId === boardId) {
          const remaining = boards.filter((b) => b.id !== boardId)
          setActiveBoardId(remaining[0]?.id ?? null)
          setItems([])
        }
      }
    } catch {
      // ignore
    }
  }

  const activeBoard = boards.find((b) => b.id === activeBoardId)

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0">
        <div className="sticky top-24 space-y-1">
          {boards.map((board) => (
            <div key={board.id} className="group relative">
              {editingBoardId === board.id ? (
                <div className="flex items-center gap-1 p-1">
                  <input
                    type="text"
                    value={editBoardName}
                    onChange={(e) => setEditBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(board.id)
                      if (e.key === "Escape") setEditingBoardId(null)
                    }}
                    onBlur={() => confirmRename(board.id)}
                    maxLength={100}
                    className="h-7 flex-1 rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveBoardId(board.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    activeBoardId === board.id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex-1 truncate">{board.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{board.itemCount}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setBoardMenuOpen(boardMenuOpen === board.id ? null : board.id)
                    }}
                    className="invisible ml-1 rounded p-0.5 hover:bg-background group-hover:visible"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </button>
              )}
              {boardMenuOpen === board.id && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full z-40 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => startRename(board.id, board.name)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <Pencil size={14} />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBoard(board.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Create board input */}
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createBoard()
              }}
              placeholder="New board"
              maxLength={100}
              className="h-7 flex-1 rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={createBoard}
              disabled={creatingBoard || !newBoardName.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creatingBoard ? <Loader2 className="animate-spin" size={14} /> : <FolderPlus size={14} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {loadingItems ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const title = item.headline || item.whoIsInPicture || item.caption || "Fotocorp archive image"
              const preview = item.previewUrl ?? item.thumbUrl
              return (
                <article key={item.assetId} className="overflow-hidden rounded-xl border border-border bg-background">
                  <Link href={`/assets/${item.assetId}`} className="group block aspect-[4/3] overflow-hidden bg-muted">
                    {preview ? (
                      <PreviewImage
                        src={preview.url}
                        alt={title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
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
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
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
                        onClick={() => remove(item.assetId)}
                        disabled={removing === item.assetId}
                        aria-label="Remove from Fotobox"
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {removing === item.assetId ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
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
              {activeBoard ? `"${activeBoard.name}" is empty` : "No board selected"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Save images from search to this board, then return here to review or download.
            </p>
            <div className="mt-5">
              <Link
                href="/search"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Browse archive
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

"use client"

import { ArrowLeft, Check, FolderPlus, Loader2, Search, X } from "lucide-react"
import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"
import {
  createAnonBoard,
  addToAnonBoard,
  removeFromAnonBoard,
  getAnonBoards,
} from "@/lib/storage/fotobox-anon-store"

interface ServerBoard {
  id: string
  name: string
  itemCount: number
  createdAt: string
}

interface FotoboxBoardPickerProps {
  assetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  assetTitle?: string
}

export function FotoboxBoardPicker({
  assetId,
  open,
  onOpenChange,
  assetTitle,
}: FotoboxBoardPickerProps) {
  const { data: session } = useSharedAuthSession()
  const isAuthenticated = !!session?.user
  const [mounted, setMounted] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [serverBoards, setServerBoards] = useState<ServerBoard[]>([])
  const [savedBoardIds, setSavedBoardIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [savingBoardId, setSavingBoardId] = useState<string | null>(null)
  const [newBoardName, setNewBoardName] = useState("")
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const fetchBoards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isAuthenticated) {
        const [boardsRes, savedRes] = await Promise.all([
          fetch("/api/fotobox/boards", { credentials: "include" }),
          fetch(`/api/fotobox/asset-board-ids?assetId=${assetId}`, { credentials: "include" }),
        ])
        if (boardsRes.ok) {
          const data = (await boardsRes.json()) as { ok: boolean; boards?: ServerBoard[] }
          if (data.ok) setServerBoards(data.boards ?? [])
        }
        if (savedRes.ok) {
          const data = (await savedRes.json()) as { ok: boolean; boardIds?: string[] }
          if (data.ok) setSavedBoardIds(new Set(data.boardIds))
        }
      } else {
        const boards = getAnonBoards()
        setServerBoards(boards.map((b) => ({ id: b.id, name: b.name, itemCount: b.items.length, createdAt: new Date(b.createdAt).toISOString() })))
        const ids = new Set<string>()
        for (const b of boards) { if (b.items.includes(assetId)) ids.add(b.id) }
        setSavedBoardIds(ids)
      }
    } catch {
      setError("Could not load boards")
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, assetId])

  useEffect(() => {
    if (open) {
      fetchBoards()
      setTimeout(() => searchInputRef.current?.focus(), 150)
    } else {
      setSearchQuery("")
    }
  }, [open, fetchBoards])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false)
    }
    if (open) document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onOpenChange])

  async function toggleBoard(boardId: string) {
    setSavingBoardId(boardId)
    setError(null)
    try {
      if (isAuthenticated) {
        if (savedBoardIds.has(boardId)) {
          await fetch(`/api/fotobox/${assetId}?boardId=${boardId}`, { method: "DELETE", credentials: "include" })
          setSavedBoardIds((prev) => { const n = new Set(prev); n.delete(boardId); return n })
        } else {
          await fetch("/api/fotobox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId, boardId }), credentials: "include" })
          setSavedBoardIds((prev) => { const n = new Set(prev); n.add(boardId); return n })
        }
      } else {
        if (savedBoardIds.has(boardId)) {
          removeFromAnonBoard(boardId, assetId)
          setSavedBoardIds((prev) => { const n = new Set(prev); n.delete(boardId); return n })
        } else {
          addToAnonBoard(boardId, assetId)
          setSavedBoardIds((prev) => { const n = new Set(prev); n.add(boardId); return n })
        }
        const boards = getAnonBoards()
        setServerBoards(boards.map((b) => ({ id: b.id, name: b.name, itemCount: b.items.length, createdAt: new Date(b.createdAt).toISOString() })))
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setSavingBoardId(null)
    }
  }

  async function createBoard() {
    const name = newBoardName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      if (isAuthenticated) {
        const res = await fetch("/api/fotobox/boards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }), credentials: "include" })
        const data = (await res.json()) as { ok: boolean; board: ServerBoard }
        if (data.ok && data.board) { setServerBoards((prev) => [...prev, data.board]); setNewBoardName("") }
      } else {
        createAnonBoard(name)
        setNewBoardName("")
        const boards = getAnonBoards()
        setServerBoards(boards.map((b) => ({ id: b.id, name: b.name, itemCount: b.items.length, createdAt: new Date(b.createdAt).toISOString() })))
      }
    } catch {
      setError("Could not create board")
    } finally {
      setCreating(false)
    }
  }

  if (!mounted || !open) return null

  const filteredBoards = searchQuery.trim()
    ? serverBoards.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : serverBoards

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {assetTitle ? `Save "${assetTitle.substring(0, 50).replace(/"/g, "").trim()}"` : "Save to Fotobox"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAuthenticated ? "Choose boards to save to" : "Saved on this device"}
            </p>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a board..."
              className="h-9 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {serverBoards.length === 0 ? "No boards yet" : searchQuery ? "No matching boards" : "No boards"}
              </p>
              {serverBoards.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Create one below to start saving</p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredBoards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => toggleBoard(board.id)}
                  disabled={savingBoardId === board.id}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent",
                    savedBoardIds.has(board.id) && "bg-accent/50",
                  )}
                >
                  {savingBoardId === board.id ? (
                    <Loader2 className="animate-spin shrink-0 text-muted-foreground" size={16} />
                  ) : (
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2",
                      savedBoardIds.has(board.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}>
                      {savedBoardIds.has(board.id) && <Check size={12} strokeWidth={3} />}
                    </span>
                  )}
                  <span className="flex-1 truncate">{board.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{board.itemCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createBoard() }}
              placeholder="Create new board"
              maxLength={100}
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={createBoard}
              disabled={creating || !newBoardName.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : <FolderPlus size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="border-t border-border px-4 py-3">
          <a href="/fotobox" className="block text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            View all boards
          </a>
        </div>
      </div>
    </div>,
    document.body,
  )
}

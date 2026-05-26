"use client"

const STORAGE_KEY = "fotobox-anon-state"

export interface AnonFotoboxState {
  clientId: string
  boards: AnonBoard[]
}

export interface AnonBoard {
  id: string
  name: string
  items: string[]
  createdAt: number
}

function readState(): AnonFotoboxState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AnonFotoboxState
  } catch {
    return null
  }
}

function writeState(state: AnonFotoboxState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function getOrCreateState(): AnonFotoboxState {
  const existing = readState()
  if (existing) return existing

  const state: AnonFotoboxState = {
    clientId: crypto.randomUUID(),
    boards: [],
  }
  writeState(state)
  return state
}

export function getAnonClientId(): string {
  return getOrCreateState().clientId
}

export function getAnonBoards(): AnonBoard[] {
  return getOrCreateState().boards
}

export function createAnonBoard(name: string): AnonBoard {
  const state = getOrCreateState()
  const board: AnonBoard = {
    id: crypto.randomUUID(),
    name: name.trim(),
    items: [],
    createdAt: Date.now(),
  }
  state.boards.push(board)
  writeState(state)
  return board
}

export function addToAnonBoard(boardId: string, assetId: string): void {
  const state = getOrCreateState()
  const board = state.boards.find((b) => b.id === boardId)
  if (!board) return
  if (!board.items.includes(assetId)) {
    board.items.push(assetId)
    writeState(state)
  }
}

export function removeFromAnonBoard(boardId: string, assetId: string): void {
  const state = getOrCreateState()
  const board = state.boards.find((b) => b.id === boardId)
  if (!board) return
  board.items = board.items.filter((id) => id !== assetId)
  writeState(state)
}

export function deleteAnonBoard(boardId: string): void {
  const state = getOrCreateState()
  state.boards = state.boards.filter((b) => b.id !== boardId)
  writeState(state)
}

export function renameAnonBoard(boardId: string, name: string): void {
  const state = getOrCreateState()
  const board = state.boards.find((b) => b.id === boardId)
  if (!board) return
  board.name = name.trim()
  writeState(state)
}

export function isAssetInAnonBoard(boardId: string, assetId: string): boolean {
  const state = readState()
  if (!state) return false
  const board = state.boards.find((b) => b.id === boardId)
  return board ? board.items.includes(assetId) : false
}

export function getAnonSavedAssetIds(): string[] {
  const state = readState()
  if (!state) return []
  const ids = new Set<string>()
  for (const board of state.boards) {
    for (const assetId of board.items) {
      ids.add(assetId)
    }
  }
  return [...ids]
}

export function getAnonStateForMigration(): AnonFotoboxState | null {
  return readState()
}

export function clearAnonState(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export async function migrateAnonBoardsToServer(): Promise<boolean> {
  const state = getAnonStateForMigration()
  if (!state || state.boards.length === 0) return false

  try {
    const response = await fetch("/api/fotobox/migrate-anon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boards: state.boards.map((b) => ({ name: b.name, items: b.items })) }),
      credentials: "include",
    })
    if (!response.ok) return false
    const data = (await response.json()) as { ok: boolean }
    if (data.ok) {
      clearAnonState()
      return true
    }
    return false
  } catch {
    return false
  }
}

import "server-only"

import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"
import {
  InternalApiRequestError,
  internalApiJson,
  internalApiRoutes,
  withQuery,
} from "@/lib/server/internal-api"

export interface AccountPreview {
  url: string
  width: number
  height: number
}

export interface FotoboxItem {
  assetId: string
  savedAt: string | null
  headline: string | null
  whoIsInPicture: string | null
  caption: string | null
  fotokey: string | null
  category: string | null
  event: string | null
  previewUrl: AccountPreview | null
  thumbUrl: AccountPreview | null
}

export interface FotoboxBoard {
  id: string
  name: string
  itemCount: number
  sortOrder: number
  createdAt: string
}

export interface FotoboxBoardsResponse {
  ok: true
  boards: FotoboxBoard[]
}

export interface FotoboxResponse {
  ok: true
  items: FotoboxItem[]
  nextCursor: string | null
}

export interface DownloadHistoryItem {
  downloadId: string
  assetId: string | null
  downloadedAt: string | null
  downloadSize: "WEB" | "MEDIUM" | "LARGE"
  status: "STARTED" | "FAILED"
  headline: string | null
  whoIsInPicture: string | null
  caption: string | null
  fotokey: string | null
  previewUrl: AccountPreview | null
  thumbUrl: AccountPreview | null
}

export interface DownloadHistoryResponse {
  ok: true
  items: DownloadHistoryItem[]
  nextCursor: string | null
}

export async function listFotoboxItems(input: {
  authUserId: string
  limit?: number
  cursor?: string
  boardId?: string
}): Promise<FotoboxResponse> {
  const params = new URLSearchParams({ authUserId: input.authUserId, limit: String(input.limit ?? 24) })
  if (input.cursor) params.set("cursor", input.cursor)
  if (input.boardId) params.set("boardId", input.boardId)

  const body = await accountJson<FotoboxResponse>({
    path: withQuery(internalApiRoutes.fotoboxItems(), params),
  })
  return {
    ...body,
    items: body.items.map(normalizeFotoboxItem),
  }
}

export async function addFotoboxItem(input: { authUserId: string; assetId: string; boardId: string }) {
  return accountJson({
    path: internalApiRoutes.fotoboxItems(),
    method: "POST",
    body: input,
  })
}

export async function removeFotoboxItem(input: { authUserId: string; assetId: string; boardId?: string }) {
  return accountJson({
    path: internalApiRoutes.fotoboxItem(input.assetId),
    method: "DELETE",
    body: { authUserId: input.authUserId, boardId: input.boardId },
  })
}

export async function listFotoboxBoards(authUserId: string): Promise<FotoboxBoardsResponse> {
  const params = new URLSearchParams({ authUserId })
  return accountJson<FotoboxBoardsResponse>({
    path: withQuery(internalApiRoutes.fotoboxBoards(), params),
  })
}

export async function createFotoboxBoard(input: { authUserId: string; name: string }) {
  return accountJson({
    path: internalApiRoutes.fotoboxBoards(),
    method: "POST",
    body: input,
  })
}

export async function renameFotoboxBoard(input: { authUserId: string; boardId: string; name: string }) {
  return accountJson({
    path: internalApiRoutes.fotoboxBoard(input.boardId),
    method: "PATCH",
    body: { authUserId: input.authUserId, name: input.name },
  })
}

export async function deleteFotoboxBoard(input: { authUserId: string; boardId: string }) {
  return accountJson({
    path: internalApiRoutes.fotoboxBoard(input.boardId),
    method: "DELETE",
    body: { authUserId: input.authUserId },
  })
}

export async function migrateAnonBoards(input: {
  authUserId: string
  appUserProfileId: string
  boards: Array<{ name: string; items: string[] }>
}) {
  return accountJson({
    path: internalApiRoutes.fotoboxMigrateAnon(),
    method: "POST",
    body: input,
  })
}

export async function listDownloadHistory(input: {
  authUserId: string
  year?: string
  month?: string
  limit?: number
  cursor?: string
}): Promise<DownloadHistoryResponse> {
  const params = new URLSearchParams({ authUserId: input.authUserId, limit: String(input.limit ?? 25) })
  if (input.year) params.set("year", input.year)
  if (input.month) params.set("month", input.month)
  if (input.cursor) params.set("cursor", input.cursor)

  const body = await accountJson<DownloadHistoryResponse>({
    path: withQuery(internalApiRoutes.downloadHistory(), params),
  })
  return {
    ...body,
    items: body.items.map(normalizeDownloadItem),
  }
}

async function accountJson<T = unknown>(input: {
  path: string
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
}): Promise<T> {
  try {
    return await internalApiJson<T>(input)
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      throw new AccountApiError(error.status, error.code ?? "INTERNAL_ERROR")
    }
    throw error
  }
}

function normalizeFotoboxItem(item: FotoboxItem): FotoboxItem {
  return {
    ...item,
    previewUrl: normalizePreview(item.previewUrl),
    thumbUrl: normalizePreview(item.thumbUrl),
  }
}

function normalizeDownloadItem(item: DownloadHistoryItem): DownloadHistoryItem {
  return {
    ...item,
    previewUrl: normalizePreview(item.previewUrl),
    thumbUrl: normalizePreview(item.thumbUrl),
  }
}

function normalizePreview(preview: AccountPreview | null) {
  if (!preview) return null
  return {
    ...preview,
    url: buildApiAssetUrl(preview.url),
  }
}

export class AccountApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Account API request failed (${status}): ${code}`)
    this.name = "AccountApiError"
  }
}

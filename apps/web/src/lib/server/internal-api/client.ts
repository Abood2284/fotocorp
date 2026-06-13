import "server-only"

import { readInternalApiError, type InternalApiErrorBody } from "@/lib/server/internal-api/errors"

type InternalApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
const INTERNAL_API_TIMEOUT_MS = 12_000

interface InternalApiFetchInput {
  path: string
  method?: InternalApiMethod
  body?: unknown
  accept?: string
  headers?: HeadersInit
  timeoutMs?: number
}

interface InternalApiJsonInput {
  path: string
  method?: InternalApiMethod
  body?: unknown
  headers?: HeadersInit
  timeoutMs?: number
}

export class InternalApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly detail: unknown,
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `Internal API request failed (${status})${code ? `: ${code}` : ""}`)
    this.name = "InternalApiRequestError"
  }
}

export async function internalApiJson<TResponse>(input: InternalApiJsonInput): Promise<TResponse> {
  const response = await internalApiFetch({
    ...input,
    accept: "application/json",
  })

  if (!response.ok) {
    throw await toRequestError(response, input.path)
  }

  return response.json() as Promise<TResponse>
}

export async function internalApiFetch(input: InternalApiFetchInput): Promise<Response> {
  const method = input.method ?? "GET"
  const timeoutMs = input.timeoutMs ?? INTERNAL_API_TIMEOUT_MS
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers = new Headers(input.headers)
  headers.set("Accept", input.accept ?? headers.get("Accept") ?? "application/json")
  headers.set("x-internal-api-secret", getInternalApiSecret())

  const init: RequestInit = {
    method,
    cache: "no-store",
    signal: controller.signal,
    headers,
  }

  if (input.body !== undefined) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json")
    init.body = JSON.stringify(input.body)
  }

  try {
    const response = await fetch(buildInternalApiUrl(input.path), init)
    console.info(JSON.stringify({
      event: "internal_api_fetch",
      path: input.path,
      method,
      status: response.status,
      durationMs: Date.now() - startedAt,
      timeoutMs,
    }))
    return response
  } catch (error) {
    console.error(JSON.stringify({
      event: "internal_api_fetch",
      path: input.path,
      method,
      status: "error",
      durationMs: Date.now() - startedAt,
      timeoutMs,
      timedOut: isAbortError(error),
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function buildInternalApiUrl(path: string) {
  const baseUrl = getInternalApiBaseUrl()
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

function getInternalApiBaseUrl() {
  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim().replace(/\/+$/, "")
  if (!baseUrl) {
    throw new Error("INTERNAL_API_BASE_URL is required for privileged internal API calls.")
  }
  return baseUrl
}

function getInternalApiSecret() {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET is required for privileged internal API calls.")
  }
  return secret
}

async function toRequestError(response: Response, path: string) {
  const error = await readInternalApiError(response)
  return new InternalApiRequestError(
    response.status,
    error.code,
    safeErrorDetail(error),
    path,
    error.message,
  )
}

function safeErrorDetail(error: InternalApiErrorBody) {
  return error.detail ?? error.rawText
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

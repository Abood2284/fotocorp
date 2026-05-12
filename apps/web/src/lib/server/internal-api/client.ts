import "server-only"

import { readInternalApiError, type InternalApiErrorBody } from "@/lib/server/internal-api/errors"

type InternalApiMethod = "GET" | "POST" | "PATCH" | "DELETE"

interface InternalApiFetchInput {
  path: string
  method?: InternalApiMethod
  body?: unknown
  accept?: string
  headers?: HeadersInit
}

interface InternalApiJsonInput {
  path: string
  method?: InternalApiMethod
  body?: unknown
  headers?: HeadersInit
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
  const headers = new Headers(input.headers)
  headers.set("Accept", input.accept ?? headers.get("Accept") ?? "application/json")
  headers.set("x-internal-api-secret", getInternalApiSecret())

  const init: RequestInit = {
    method,
    cache: "no-store",
    headers,
  }

  if (input.body !== undefined) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json")
    init.body = JSON.stringify(input.body)
  }

  return fetch(buildInternalApiUrl(input.path), init)
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

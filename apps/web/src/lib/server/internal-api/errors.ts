import "server-only"

export interface InternalApiErrorBody {
  code?: string
  message?: string
  detail?: unknown
  rawText?: string
}

const MAX_RAW_TEXT_LENGTH = 1000

export async function readInternalApiError(response: Response): Promise<InternalApiErrorBody> {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.toLowerCase().includes("application/json")) {
    const body = await response.clone().json().catch(() => null)
    const parsed = parseJsonError(body)
    if (parsed.code || parsed.message || parsed.detail !== undefined) {
      return parsed
    }
  }

  const text = await response.clone().text().catch(() => "")
  return text ? { rawText: text.slice(0, MAX_RAW_TEXT_LENGTH) } : {}
}

function parseJsonError(body: unknown): InternalApiErrorBody {
  if (!isRecord(body)) return {}

  const error = isRecord(body.error) ? body.error : body
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    detail: "detail" in error ? error.detail : "details" in error ? error.details : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

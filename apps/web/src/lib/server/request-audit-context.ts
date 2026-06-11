import { createHash } from "node:crypto"

export interface RequestAuditContext {
  ipAddress: string | null
  ipHash: string | null
  country: string | null
  city: string | null
  region: string | null
  regionCode: string | null
  cfRay: string | null
  userAgent: string | null
}

export interface GetRequestAuditContextOptions {
  ipHashSecret?: string | null
}

export function getRequestAuditContext(
  request: Request,
  options?: GetRequestAuditContextOptions,
): RequestAuditContext {
  const ipAddress = extractIpAddress(request)
  const { country, city, region, regionCode } = extractGeo(request)

  return {
    ipAddress,
    ipHash: computeIpHash(ipAddress, options?.ipHashSecret ?? null),
    country,
    city,
    region,
    regionCode,
    cfRay: normalizeOptionalString(request.headers.get("CF-Ray")),
    userAgent: normalizeOptionalString(request.headers.get("User-Agent")),
  }
}

function extractIpAddress(request: Request): string | null {
  const connectingIp = normalizeOptionalString(request.headers.get("CF-Connecting-IP"))
  if (connectingIp) return connectingIp

  const forwardedFor = request.headers.get("X-Forwarded-For")
  if (!forwardedFor) return null

  const firstIp = forwardedFor.split(",")[0]
  return normalizeOptionalString(firstIp)
}

function extractGeo(request: Request): Pick<RequestAuditContext, "country" | "city" | "region" | "regionCode"> {
  const cf = readRequestCf(request)

  return {
    country: normalizeCountry(readCfString(cf, "country") ?? request.headers.get("CF-IPCountry")),
    city: normalizeOptionalString(readCfString(cf, "city") ?? request.headers.get("CF-IPCity")),
    region: normalizeOptionalString(readCfString(cf, "region") ?? request.headers.get("CF-Region")),
    regionCode: normalizeOptionalString(readCfString(cf, "regionCode") ?? request.headers.get("CF-Region-Code")),
  }
}

function readRequestCf(request: Request): Record<string, unknown> | null {
  const cf = (request as Request & { cf?: unknown }).cf
  if (!cf || typeof cf !== "object") return null
  return cf as Record<string, unknown>
}

function readCfString(cf: Record<string, unknown> | null, key: string): string | null {
  if (!cf) return null
  const value = cf[key]
  if (typeof value !== "string") return null
  return value
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value)
  return normalized ? normalized.toUpperCase() : null
}

function computeIpHash(ipAddress: string | null, ipHashSecret: string | null): string | null {
  if (!ipAddress || !ipHashSecret) return null
  return createHash("sha256").update(`${ipAddress}:${ipHashSecret}`).digest("hex")
}

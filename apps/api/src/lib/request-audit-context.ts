import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"

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
  // 1. CF-Connecting-IP (set by Cloudflare edge — most reliable in production)
  const connectingIp = normalizeOptionalString(request.headers.get("CF-Connecting-IP"))
  if (connectingIp && !isNonRoutableIp(connectingIp)) return connectingIp

  // 2. X-Forwarded-For — take the leftmost (original client) IP
  const forwardedFor = request.headers.get("X-Forwarded-For")
  if (forwardedFor) {
    const firstIp = normalizeOptionalString(forwardedFor.split(",")[0])
    if (firstIp && !isNonRoutableIp(firstIp)) return firstIp
  }

  // 3. Fall back to loopback/private IPs if nothing else is available
  //    so local dev still has *some* value rather than null.
  if (connectingIp) return connectingIp
  if (forwardedFor) {
    const firstIp = normalizeOptionalString(forwardedFor.split(",")[0])
    if (firstIp) return firstIp
  }

  return null
}

/**
 * Returns true when the IP is a loopback, link-local, or private address.
 * These addresses carry no usable signal about the original client so we
 * prefer to skip them when a better source (CF-Connecting-IP or
 * X-Forwarded-For) is available.
 */
function isNonRoutableIp(ip: string): boolean {
  // IPv4 loopback
  if (ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") return true
  // IPv6 loopback
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true
  // IPv4 link-local
  if (ip.startsWith("169.254.")) return true
  // IPv6 link-local
  if (ip.toLowerCase().startsWith("fe80:")) return true
  // Private IPv4 ranges
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) {
    const parts = ip.split(".")
    if (parts.length === 4) {
      const second = Number(parts[1])
      if (ip.startsWith("172.") && second >= 16 && second <= 31) return true
      if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true
    }
  }
  return false
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
  return bytesToHex(sha256(new TextEncoder().encode(`${ipAddress}:${ipHashSecret}`)))
}

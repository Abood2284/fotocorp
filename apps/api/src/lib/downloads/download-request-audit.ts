import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import type { RequestAuditContext } from "../request-audit-context"

export interface DownloadRequestAuditPayload {
  ipAddress?: string | null
  ipHash?: string | null
  country?: string | null
  city?: string | null
  region?: string | null
  regionCode?: string | null
  cfRay?: string | null
  userAgent?: string | null
}

export interface NormalizedDownloadRequestAudit {
  ipAddress: string | null
  ipHash: string | null
  country: string | null
  city: string | null
  region: string | null
  regionCode: string | null
  cfRay: string | null
  userAgent: string | null
}

export function normalizeDownloadRequestAudit(input: {
  requestAudit?: Partial<DownloadRequestAuditPayload> | Partial<RequestAuditContext> | null
  requestIp?: string | null
  userAgent?: string | null
  ipHashSecret?: string | null
}): NormalizedDownloadRequestAudit {
  const requestAudit = input.requestAudit ?? null
  const ipAddress = normalizeOptionalString(requestAudit?.ipAddress ?? input.requestIp ?? null)
  const userAgent = normalizeOptionalString(requestAudit?.userAgent ?? input.userAgent ?? null)
  const ipHash =
    normalizeOptionalString(requestAudit?.ipHash ?? null)
    ?? computeIpHash(ipAddress, input.ipHashSecret ?? null)

  return {
    ipAddress,
    ipHash,
    country: normalizeCountry(requestAudit?.country ?? null),
    city: normalizeOptionalString(requestAudit?.city ?? null),
    region: normalizeOptionalString(requestAudit?.region ?? null),
    regionCode: normalizeOptionalString(requestAudit?.regionCode ?? null),
    cfRay: normalizeOptionalString(requestAudit?.cfRay ?? null),
    userAgent,
  }
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

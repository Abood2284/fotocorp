// apps/web/src/lib/api/subscriber-downloads-api.ts
import "server-only"

import {
  internalApiFetch,
  internalApiRoutes,
  readInternalApiError,
} from "@/lib/server/internal-api"

export type SubscriberDownloadSize = "web" | "medium" | "large"

async function readSafeErrorCode(response: Response): Promise<string | undefined> {
  const error = await readInternalApiError(response)
  return error.code
}

function logInternalResponseError(details: {
  pathname: string
  assetId: string
  assetIdLength: number
  assetIdJson: string
  size: SubscriberDownloadSize
  method: string
  status: number
  safeErrorCode?: string
}) {
  console.info("subscriber_download_internal_response_error", details)
}

export async function fetchSubscriberAssetDownload(input: {
  assetId: string
  authUserId: string
  size: SubscriberDownloadSize
  userAgent?: string | null
  requestIp?: string | null
}) {
  const pathname = internalApiRoutes.subscriberAssetDownload(input.assetId)
  const response = await internalApiFetch({
    path: pathname,
    method: "POST",
    accept: "application/octet-stream, application/json",
    body: {
      authUserId: input.authUserId,
      size: input.size,
      userAgent: input.userAgent ?? undefined,
      requestIp: input.requestIp ?? undefined,
    },
  })

  if (!response.ok) {
    const safeErrorCode = await readSafeErrorCode(response)
    logInternalResponseError({
      pathname,
      assetId: input.assetId,
      assetIdLength: input.assetId.length,
      assetIdJson: JSON.stringify(input.assetId),
      size: input.size,
      method: "POST",
      status: response.status,
      safeErrorCode,
    })
  }

  return response
}

export async function fetchSubscriberAssetDownloadCheck(input: {
  assetId: string
  authUserId: string
  size: SubscriberDownloadSize
  userAgent?: string | null
  requestIp?: string | null
}) {
  const pathname = internalApiRoutes.subscriberAssetDownloadCheck(input.assetId)
  const response = await internalApiFetch({
    path: pathname,
    method: "POST",
    accept: "application/json",
    body: {
      authUserId: input.authUserId,
      size: input.size,
      userAgent: input.userAgent ?? undefined,
      requestIp: input.requestIp ?? undefined,
    },
  })

  if (!response.ok) {
    const safeErrorCode = await readSafeErrorCode(response)
    logInternalResponseError({
      pathname,
      assetId: input.assetId,
      assetIdLength: input.assetId.length,
      assetIdJson: JSON.stringify(input.assetId),
      size: input.size,
      method: "POST",
      status: response.status,
      safeErrorCode,
    })
  }

  return response
}

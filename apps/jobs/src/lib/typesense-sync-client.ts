const DEFAULT_TIMEOUT_MS = 10_000

export interface NotifyTypesenseSyncAssetParams {
  apiBaseUrl: string | undefined
  internalSecret: string | undefined
  assetId: string
  critical?: boolean
}

export async function notifyTypesenseSyncAsset(params: NotifyTypesenseSyncAssetParams): Promise<void> {
  await notifyTypesenseSyncInternal({
    path: "/api/v1/internal/search/typesense/sync-asset",
    body: { assetId: params.assetId, critical: params.critical ?? false },
    logAssetId: params.assetId,
    apiBaseUrl: params.apiBaseUrl,
    internalSecret: params.internalSecret,
    okEvent: "typesense_sync_callback_ok",
    failEvent: "typesense_sync_callback_failed",
    skipEvent: "typesense_sync_skipped_jobs_env",
  })
}

export interface NotifyTypesenseSyncCaricatureParams {
  apiBaseUrl: string | undefined
  internalSecret: string | undefined
  assetId: string
  critical?: boolean
}

export async function notifyTypesenseSyncCaricature(
  params: NotifyTypesenseSyncCaricatureParams,
): Promise<void> {
  await notifyTypesenseSyncInternal({
    path: "/api/v1/internal/search/typesense/sync-caricature",
    body: { assetId: params.assetId, critical: params.critical ?? false },
    logAssetId: params.assetId,
    apiBaseUrl: params.apiBaseUrl,
    internalSecret: params.internalSecret,
    okEvent: "typesense_caricature_sync_callback_ok",
    failEvent: "typesense_caricature_sync_callback_failed",
    skipEvent: "typesense_caricature_sync_skipped_jobs_env",
  })
}

async function notifyTypesenseSyncInternal(params: {
  path: string
  body: Record<string, unknown>
  logAssetId: string
  apiBaseUrl: string | undefined
  internalSecret: string | undefined
  okEvent: string
  failEvent: string
  skipEvent: string
}): Promise<void> {
  const { apiBaseUrl, internalSecret, logAssetId } = params
  if (!apiBaseUrl?.trim() || !internalSecret?.trim()) {
    console.warn(
      JSON.stringify({
        event: params.skipEvent,
        assetId: logAssetId,
        reason: "FOTOCORP_API_BASE_URL or INTERNAL_API_SECRET is not configured",
      }),
    )
    return
  }

  const url = new URL(params.path, apiBaseUrl.trim().replace(/\/+$/, ""))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("typesense_sync_callback_timeout"), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-internal-api-secret": internalSecret.trim(),
      },
      body: JSON.stringify(params.body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(
        JSON.stringify({
          event: params.failEvent,
          assetId: logAssetId,
          status: response.status,
          body: body.slice(0, 200),
        }),
      )
      return
    }

    console.info(JSON.stringify({ event: params.okEvent, assetId: logAssetId, critical: Boolean(params.body.critical) }))
  } catch (error) {
    console.error(
      JSON.stringify({
        event: `${params.failEvent}_error`,
        assetId: logAssetId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}

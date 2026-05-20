const DEFAULT_TIMEOUT_MS = 10_000

export interface NotifyTypesenseSyncAssetParams {
  apiBaseUrl: string | undefined
  internalSecret: string | undefined
  assetId: string
  critical?: boolean
}

export async function notifyTypesenseSyncAsset(params: NotifyTypesenseSyncAssetParams): Promise<void> {
  const { apiBaseUrl, internalSecret, assetId, critical } = params
  if (!apiBaseUrl?.trim() || !internalSecret?.trim()) {
    console.warn(
      JSON.stringify({
        event: "typesense_sync_skipped_jobs_env",
        assetId,
        reason: "FOTOCORP_API_BASE_URL or INTERNAL_API_SECRET is not configured",
      }),
    )
    return
  }

  const url = new URL(
    "/api/v1/internal/search/typesense/sync-asset",
    apiBaseUrl.trim().replace(/\/+$/, ""),
  )
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
      body: JSON.stringify({ assetId, critical: critical ?? false }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(
        JSON.stringify({
          event: "typesense_sync_callback_failed",
          assetId,
          status: response.status,
          body: body.slice(0, 200),
        }),
      )
      return
    }

    console.info(JSON.stringify({ event: "typesense_sync_callback_ok", assetId, critical: Boolean(critical) }))
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "typesense_sync_callback_error",
        assetId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}

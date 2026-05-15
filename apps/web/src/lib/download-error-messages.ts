/** User-facing copy for subscriber download flows (browser-safe; no secrets). */

export function messageForSubscriberDownloadErrorCode(code: string | undefined | null): string {
  switch (code) {
    case "AUTH_REQUIRED":
      return "Please sign in to download licensed files."
    case "SUBSCRIPTION_REQUIRED":
      return "Downloads require active subscriber access."
    case "PROFILE_NOT_FOUND":
      return "Downloads require active subscriber access."
    case "ENTITLEMENT_REQUIRED":
      return "Your account does not include downloads for this asset type."
    case "QUALITY_NOT_ALLOWED":
      return "Your access does not include this download quality."
    case "DOWNLOAD_LIMIT_EXCEEDED":
    case "QUOTA_EXCEEDED":
      return "Download limit reached. reachout to admin for more limits."
    case "SUBSCRIPTION_EXPIRED":
      return "Your subscriber access has expired. Renew access to download files."
    case "SIZE_NOT_AVAILABLE":
    case "INVALID_DOWNLOAD_SIZE":
      return "That download size is not available yet."
    case "ASSET_NOT_DOWNLOADABLE":
      return "This asset is not currently available for download."
    case "ASSET_NOT_FOUND":
      return "This asset is not currently available for download."
    case "SOURCE_FILE_NOT_FOUND":
      return "The clean source file is not available yet."
    case "INVALID_ASSET_ID":
      return "This download link is invalid."
    case "PROFILE_LOOKUP_FAILED":
      return "Your account session is active, but profile access could not be loaded. Refresh or sign in again."
    default:
      return "The download could not be started. Please try again."
  }
}

/** Maps GET `/api/assets/.../download` redirect query values to display strings. */
export function messageForDownloadRedirectError(code: string | undefined): string | null {
  switch (code) {
    case "quota-exceeded":
      return messageForSubscriberDownloadErrorCode("DOWNLOAD_LIMIT_EXCEEDED")
    case "download-limit-exceeded":
      return messageForSubscriberDownloadErrorCode("DOWNLOAD_LIMIT_EXCEEDED")
    case "subscription-required":
      return messageForSubscriberDownloadErrorCode("SUBSCRIPTION_REQUIRED")
    case "entitlement-required":
      return messageForSubscriberDownloadErrorCode("ENTITLEMENT_REQUIRED")
    case "quality-not-allowed":
      return messageForSubscriberDownloadErrorCode("QUALITY_NOT_ALLOWED")
    case "subscription-expired":
      return messageForSubscriberDownloadErrorCode("SUBSCRIPTION_EXPIRED")
    case "size-not-available":
      return messageForSubscriberDownloadErrorCode("SIZE_NOT_AVAILABLE")
    case "asset-unavailable":
      return messageForSubscriberDownloadErrorCode("ASSET_NOT_DOWNLOADABLE")
    case "invalid-asset-id":
      return messageForSubscriberDownloadErrorCode("INVALID_ASSET_ID")
    case "download-failed":
      return messageForSubscriberDownloadErrorCode("INTERNAL_ERROR")
    case "profile-lookup-failed":
      return messageForSubscriberDownloadErrorCode("PROFILE_LOOKUP_FAILED")
    case "not-signed-in":
      return "Sign in with subscriber access to download clean licensed files."
    default:
      return null
  }
}

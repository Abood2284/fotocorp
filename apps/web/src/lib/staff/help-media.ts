export const HELP_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const HELP_VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const HELP_VIDEO_MAX_DURATION_SECONDS = 5 * 60

export function getHelpMediaDisplayUrl(mediaId: string) {
  return `/api/staff/help/media/${encodeURIComponent(mediaId)}`
}

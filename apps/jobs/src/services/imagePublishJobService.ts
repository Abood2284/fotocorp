/**
 * Placeholder for publish job persistence.
 * Later: list pending work from `image_publish_jobs` (and related items).
 */

export interface PendingPublishJobRow {
  id: string
  status: string
}

export class ImagePublishJobService {
  async listPendingJobs(): Promise<PendingPublishJobRow[]> {
    return []
  }
}

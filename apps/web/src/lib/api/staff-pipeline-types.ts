export interface JobsPipelineQueueCounts {
  queued: number
  running: number
  failedLast24h: number
}

export interface JobsPipelineWorkerHint {
  reachable: boolean
  drainInProgress: boolean | null
}

export type JobsPipelineActiveWorkKind =
  | "catalog_preview_regen"
  | "image_publish_item"
  | "caricature_preview"

export interface JobsPipelineActiveWorkItem {
  kind: JobsPipelineActiveWorkKind
  jobId: string
  itemId: string | null
  imageAssetId: string | null
  caricatureAssetId: string | null
  fotokey: string | null
  legacyImageCode: string | null
  importFileName: string | null
  status: string
  createdAt: string | null
  startedAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

export interface JobsPipelineRecentDerivativeUpdate {
  assetId: string
  fotokey: string | null
  legacyImageCode: string | null
  variant: string
  generationStatus: string
  watermarkProfile: string | null
  isWatermarked: boolean
  width: number | null
  height: number | null
  sizeBytes: number | null
  profileMatchesPolicy: boolean
  updatedAt: string | null
  generatedAt: string | null
}

export interface JobsPipelineSnapshot {
  generatedAt: string
  worker: JobsPipelineWorkerHint
  queues: {
    catalogPreviewRegen: JobsPipelineQueueCounts
    imagePublishItems: JobsPipelineQueueCounts
    caricaturePreview: JobsPipelineQueueCounts
  }
  activeWork: JobsPipelineActiveWorkItem[]
  recentDerivativeUpdates: JobsPipelineRecentDerivativeUpdate[]
}

export type JobsPipelineWakeStatus =
  | "accepted"
  | "already_running"
  | "not_configured"
  | "unreachable"
  | "failed"
  | "processing_disabled"

export interface JobsPipelineDrainSummaryHint {
  pendingAtStart: number
  pendingAtEnd: number
  processed: number
  stopReason: string
  durationMs: number
}

export interface JobsPipelineWakeResult {
  ok: boolean
  status: JobsPipelineWakeStatus
  message: string
  httpStatus?: number
  drainSummary?: JobsPipelineDrainSummaryHint
}

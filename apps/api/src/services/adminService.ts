import type {
  IngestionRunDetailResponseDto,
  AdminAssetDetailDto,
  AdminAssetDetailResponseDto,
  AdminAssetListItemDto,
  AdminAssetListResponseDto,
  IngestionRunsResponseDto
} from "../lib/dtos";
import { notFoundError } from "../lib/errors";
import type { FixtureAssetRecord } from "../lib/fixtures";
import type { PreviewService } from "./previewService";
import type { CatalogRepository } from "./repositories/catalogRepository";
import type {
  IngestionRunDetail,
  IngestionRunSummary
} from "../../../../packages/shared/src";

function toAdminAssetListItemDto(
  asset: FixtureAssetRecord,
  previewService: PreviewService
): AdminAssetListItemDto {
  const mediaAccess = previewService.buildMediaAccess(asset.id);

  return {
    id: asset.id,
    title: asset.title,
    filename: asset.filename,
    previewUrl: asset.previewUrl,
    thumbnailUrl: asset.previewUrl,
    mediaAccess,
    mediaType: asset.mediaType,
    createdAt: asset.createdAt,
    tags: asset.tags,
    visibility: asset.visibility,
    ingestionStatus: asset.ingestionStatus,
    ingestionRunId: asset.ingestionRunId
  };
}

function toAdminAssetDetailDto(
  asset: FixtureAssetRecord,
  previewService: PreviewService
): AdminAssetDetailDto {
  return {
    ...toAdminAssetListItemDto(asset, previewService),
    downloadUrl: "",
    capturedAt: asset.capturedAt,
    dimensions: {
      width: asset.width,
      height: asset.height
    },
    description: asset.description,
    collection: asset.collection,
    location: asset.location,
    checksumSha256: asset.checksumSha256,
    metadata: asset.metadata
  };
}

function toIngestionRunSummaryDto(run: IngestionRunDetail): IngestionRunSummary {
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    counts: run.counts,
    triggeredBy: run.triggeredBy
  };
}

export class AdminService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly previewService: PreviewService
  ) {}

  async listAssets(): Promise<AdminAssetListResponseDto> {
    const assets = await this.repository.listAssets();

    return {
      ok: true,
      items: assets.map((asset) => toAdminAssetListItemDto(asset, this.previewService)),
      total: assets.length
    };
  }

  async getAssetById(id: string): Promise<AdminAssetDetailResponseDto> {
    const asset = await this.repository.getAssetById(id);
    if (!asset) {
      throw notFoundError("asset", id);
    }

    return {
      ok: true,
      item: toAdminAssetDetailDto(asset, this.previewService)
    };
  }

  async listIngestionRuns(): Promise<IngestionRunsResponseDto> {
    const runs = await this.repository.listIngestionRuns();

    return {
      ok: true,
      items: runs.map(toIngestionRunSummaryDto),
      total: runs.length
    };
  }

  async getIngestionRunById(id: string): Promise<IngestionRunDetailResponseDto> {
    const run = await this.repository.getIngestionRunById(id);
    if (!run) {
      throw notFoundError("ingestion run", id, "INGESTION_RUN");
    }

    return {
      ok: true,
      item: run
    };
  }
}

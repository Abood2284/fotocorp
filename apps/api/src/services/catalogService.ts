import type {
  AssetDetailDto,
  AssetDetailResponseDto,
  AssetListItemDto,
  AssetListResponseDto,
  SearchResponseDto
} from "../lib/dtos";
import { AppError, notFoundError } from "../lib/errors";
import type { FixtureAssetRecord } from "../lib/fixtures";
import type { PreviewService } from "./previewService";
import type { CatalogRepository } from "./repositories/catalogRepository";

function toAssetListItemDto(
  asset: FixtureAssetRecord,
  previewService: PreviewService
): AssetListItemDto {
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
    tags: asset.tags
  };
}

function toAssetDetailDto(
  asset: FixtureAssetRecord,
  previewService: PreviewService
): AssetDetailDto {
  return {
    ...toAssetListItemDto(asset, previewService),
    downloadUrl: "",
    capturedAt: asset.capturedAt,
    dimensions: {
      width: asset.width,
      height: asset.height
    },
    description: asset.description,
    collection: asset.collection,
    location: asset.location
  };
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly previewService: PreviewService
  ) {}

  async listAssets(): Promise<AssetListResponseDto> {
    const assets = await this.repository.listAssets();
    const publicAssets = assets.filter((asset) => asset.visibility === "public");

    return {
      ok: true,
      items: publicAssets.map((asset) => toAssetListItemDto(asset, this.previewService)),
      total: publicAssets.length
    };
  }

  async getAssetById(id: string): Promise<AssetDetailResponseDto> {
    const asset = await this.repository.getAssetById(id);
    if (!asset || asset.visibility !== "public") {
      throw notFoundError("asset", id);
    }

    return {
      ok: true,
      item: toAssetDetailDto(asset, this.previewService)
    };
  }

  async searchAssets(query: string): Promise<SearchResponseDto> {
    if (!query.trim()) {
      throw new AppError(400, "INVALID_QUERY", "Search query 'q' is required");
    }

    const assets = await this.repository.searchAssets(query);
    const publicAssets = assets.filter((asset) => asset.visibility === "public");

    return {
      ok: true,
      query,
      items: publicAssets.map((asset) => toAssetListItemDto(asset, this.previewService)),
      total: publicAssets.length
    };
  }
}

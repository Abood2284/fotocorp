import type {
  IngestionRunDetail,
  IngestionRunSummary
} from "../../../../packages/shared/src";

export interface ErrorResponseDto {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface MediaAccessDto {
  preview: {
    url: string;
    access: "preview-only";
  };
  original: {
    url: string;
    access: "protected";
    status: "gated";
  };
}

export interface PreviewResponseMetadataDto {
  requestedKey: string;
  resolvedKey: string;
  contentType: string;
  cacheControl: string;
  access: "preview-only";
  watermark: {
    status: "not_applied";
    reason: "no_watermark_hook_configured";
  };
  transformation: {
    status: "passthrough";
  };
}

export interface MediaAccessResponseDto {
  ok: true;
  media: MediaAccessDto;
}

export interface HealthResponseDto {
  ok: true;
  service: "fotocorp-api";
  environment: "fixture";
  version: "provisional";
}

export interface AssetListItemDto {
  id: string;
  title: string;
  filename: string;
  previewUrl: string;
  thumbnailUrl: string;
  mediaAccess: MediaAccessDto;
  mediaType: "image";
  createdAt: string;
  tags: string[];
}

export interface AssetListResponseDto {
  ok: true;
  items: AssetListItemDto[];
  total: number;
}

export interface AssetDetailDto {
  id: string;
  title: string;
  filename: string;
  previewUrl: string;
  thumbnailUrl: string;
  downloadUrl: string;
  mediaAccess: MediaAccessDto;
  mediaType: "image";
  createdAt: string;
  capturedAt: string | null;
  dimensions: {
    width: number;
    height: number;
  };
  description: string;
  tags: string[];
  collection: string;
  location: string | null;
}

export interface AssetDetailResponseDto {
  ok: true;
  item: AssetDetailDto;
}

export interface SearchResponseDto {
  ok: true;
  query: string;
  items: AssetListItemDto[];
  total: number;
}

export interface AdminAssetListItemDto extends AssetListItemDto {
  visibility: "public" | "internal";
  ingestionStatus: "indexed" | "processing" | "failed";
  ingestionRunId: string;
}

export interface AdminAssetListResponseDto {
  ok: true;
  items: AdminAssetListItemDto[];
  total: number;
}

export interface AdminAssetDetailDto extends AssetDetailDto {
  visibility: "public" | "internal";
  ingestionStatus: "indexed" | "processing" | "failed";
  ingestionRunId: string;
  checksumSha256: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface AdminAssetDetailResponseDto {
  ok: true;
  item: AdminAssetDetailDto;
}

export type IngestionRunSummaryDto = IngestionRunSummary;

export interface IngestionRunsResponseDto {
  ok: true;
  items: IngestionRunSummaryDto[];
  total: number;
}

export type IngestionRunDetailDto = IngestionRunDetail;

export interface IngestionRunDetailResponseDto {
  ok: true;
  item: IngestionRunDetailDto;
}

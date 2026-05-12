import type {
  MediaAccessDto,
  PreviewResponseMetadataDto
} from "../lib/dtos";
import { buildOriginalPath, buildPreviewPath } from "../lib/media";
import { notFoundError } from "../lib/errors";
import type { StorageService, StoredObject } from "./storage/storageService";

export interface PreviewWatermarkHookResult {
  status: "not_applied";
  reason: "no_watermark_hook_configured";
}

export interface PreviewTransformHookResult {
  status: "passthrough";
}

export interface PreviewPipelineResult {
  object: StoredObject;
  metadata: PreviewResponseMetadataDto;
}

export interface PreviewServiceOptions {
  watermarkHook?: (key: string) => Promise<PreviewWatermarkHookResult> | PreviewWatermarkHookResult;
}

const defaultWatermarkHook = (): PreviewWatermarkHookResult => ({
  status: "not_applied",
  reason: "no_watermark_hook_configured"
});

export class PreviewService {
  private readonly watermarkHook: NonNullable<PreviewServiceOptions["watermarkHook"]>;

  constructor(
    private readonly storage: StorageService,
    options: PreviewServiceOptions = {}
  ) {
    this.watermarkHook = options.watermarkHook ?? defaultWatermarkHook;
  }

  resolvePreviewSourceKey(requestedKey: string): string {
    return requestedKey;
  }

  buildMediaAccess(key: string): MediaAccessDto {
    return {
      preview: {
        url: "",
        access: "preview-only",
      },
      original: {
        url: "",
        access: "protected",
        status: "gated"
      }
    };
  }

  async getPreviewPipelineResult(requestedKey: string): Promise<PreviewPipelineResult> {
    const resolvedKey = this.resolvePreviewSourceKey(requestedKey);
    const object = await this.storage.getObject(resolvedKey);

    if (!object || !object.body) {
      throw notFoundError("preview media", requestedKey, "PREVIEW_MEDIA");
    }

    return {
      object,
      metadata: await this.buildPreviewResponseMetadata(requestedKey, resolvedKey, object)
    };
  }

  async previewExists(requestedKey: string): Promise<boolean> {
    const resolvedKey = this.resolvePreviewSourceKey(requestedKey);
    return this.storage.objectExists(resolvedKey);
  }

  async buildPreviewResponseMetadata(
    requestedKey: string,
    resolvedKey: string,
    object: StoredObject
  ): Promise<PreviewResponseMetadataDto> {
    return {
      requestedKey,
      resolvedKey,
      contentType: object.contentType ?? "application/octet-stream",
      cacheControl: object.cacheControl ?? "private, max-age=60, stale-while-revalidate=300",
      access: "preview-only",
      watermark: await this.watermarkHook(resolvedKey),
      transformation: {
        status: "passthrough"
      }
    };
  }
}

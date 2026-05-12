import type { MediaAccessDto, MediaAccessResponseDto } from "../lib/dtos";
import { buildOriginalPath, buildPreviewPath } from "../lib/media";
import { AppError, notFoundError } from "../lib/errors";
import type { StorageService } from "./storage/storageService";

export interface OriginalAccessPlaceholder {
  key: string;
  access: "restricted";
  reason: "entitlement_required";
  message: string;
}

export class MediaService {
  constructor(private readonly storage: StorageService) {}

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

  async getMediaAccess(key: string): Promise<MediaAccessResponseDto> {
    await this.requireExistingObject(key);

    return {
      ok: true,
      media: this.buildMediaAccess(key)
    };
  }

  async requireExistingObject(key: string): Promise<void> {
    const exists = await this.storage.objectExists(key);
    if (!exists) {
      throw notFoundError("media object", key, "MEDIA_OBJECT");
    }
  }

  async getOriginalPlaceholder(key: string): Promise<OriginalAccessPlaceholder> {
    await this.requireExistingObject(key);

    return {
      key,
      access: "restricted",
      reason: "entitlement_required",
      message: "Original media access is gated and will be enabled through a future entitlement check."
    };
  }

  async assertOriginalAccess(_key: string): Promise<never> {
    throw new AppError(
      403,
      "ORIGINAL_ACCESS_RESTRICTED",
      "Original media access is not enabled yet"
    );
  }
}

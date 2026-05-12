import { AppError } from "../../lib/errors";

export interface StoredObject {
  body: ReadableStream | null;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  uploaded: Date | null;
  cacheControl: string | null;
}

export interface StorageService {
  getObject(key: string): Promise<StoredObject | null>;
  headObject(key: string): Promise<StoredObject | null>;
  objectExists(key: string): Promise<boolean>;
}

function normalizeObject(object: R2ObjectBody | R2Object): StoredObject {
  return {
    body: "body" in object ? object.body : null,
    contentType: object.httpMetadata?.contentType ?? null,
    contentLength: object.size ?? null,
    etag: object.httpEtag ?? null,
    uploaded: object.uploaded ?? null,
    cacheControl: object.httpMetadata?.cacheControl ?? null
  };
}

export class R2StorageService implements StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  async getObject(key: string): Promise<StoredObject | null> {
    const object = await this.bucket.get(key);
    return object ? normalizeObject(object) : null;
  }

  async headObject(key: string): Promise<StoredObject | null> {
    const object = await this.bucket.head(key);
    return object ? normalizeObject(object) : null;
  }

  async objectExists(key: string): Promise<boolean> {
    return (await this.headObject(key)) !== null;
  }
}

export function assertStorageKeyPresent(key: string): string {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new AppError(400, "INVALID_OBJECT_KEY", "Object key is required");
  }

  return normalizedKey;
}

export interface R2ReadResult {
  body: ReadableStream | null;
  contentType: string | null;
  etag: string | null;
  contentLength: number | null;
  uploaded: Date | null;
}

export async function getR2Object(bucket: R2Bucket, key: string): Promise<R2ReadResult | null> {
  const object = await bucket.get(key);
  if (!object) return null;

  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? null,
    etag: object.httpEtag ?? null,
    contentLength: object.size ?? null,
    uploaded: object.uploaded ?? null,
  };
}

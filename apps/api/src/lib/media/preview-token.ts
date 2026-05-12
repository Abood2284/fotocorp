import { AppError } from "../errors";

export const MEDIA_PREVIEW_VARIANTS = ["thumb", "card", "detail"] as const;
export type MediaPreviewVariant = (typeof MEDIA_PREVIEW_VARIANTS)[number];

interface PreviewTokenPayload {
  assetId: string;
  variant: MediaPreviewVariant;
  expiresAt: number;
}

const encoder = new TextEncoder();

export function parseMediaPreviewVariant(value: string | null): MediaPreviewVariant {
  if (MEDIA_PREVIEW_VARIANTS.includes(value as MediaPreviewVariant)) {
    return value as MediaPreviewVariant;
  }

  throw new AppError(400, "INVALID_VARIANT", "Unsupported preview variant.");
}

export async function createPreviewToken(
  payload: PreviewTokenPayload,
  secret: string | undefined,
): Promise<string> {
  assertPreviewTokenSecret(secret);

  const encodedPayload = base64UrlEncode(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = await sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function verifyPreviewToken(
  token: string,
  expected: Pick<PreviewTokenPayload, "assetId" | "variant">,
  secret: string | undefined,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
): Promise<PreviewTokenPayload> {
  assertPreviewTokenSecret(secret);

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid.");
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = await sign(encodedPayload, secret);

  if (!constantTimeEqual(base64UrlDecode(providedSignature), base64UrlDecode(expectedSignature))) {
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid.");
  }

  const payload = parsePayload(encodedPayload);

  if (payload.expiresAt < nowUnixSeconds) {
    throw new AppError(401, "EXPIRED_PREVIEW_TOKEN", "Preview token has expired.");
  }

  if (payload.assetId !== expected.assetId || payload.variant !== expected.variant) {
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid for this asset.");
  }

  return payload;
}

export async function createPreviewUrl(
  assetId: string,
  variant: MediaPreviewVariant,
  secret: string | undefined,
  ttlSeconds = 3600,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await createPreviewToken({ assetId, variant, expiresAt }, secret);
  const params = new URLSearchParams({ variant, token });

  return `/api/v1/media/assets/${encodeURIComponent(assetId)}/preview?${params.toString()}`;
}

function assertPreviewTokenSecret(secret: string | undefined): asserts secret is string {
  if (!secret?.trim()) {
    throw new AppError(500, "PREVIEW_SERVICE_NOT_CONFIGURED", "Preview service is not configured.");
  }
}

async function sign(encodedPayload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));

  return base64UrlEncode(new Uint8Array(signature));
}

function parsePayload(encodedPayload: string): PreviewTokenPayload {
  try {
    const raw = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const parsed = JSON.parse(raw) as Partial<PreviewTokenPayload>;

    return {
      assetId: assertString(parsed.assetId),
      variant: parseMediaPreviewVariant(assertString(parsed.variant)),
      expiresAt: assertUnixTimestamp(parsed.expiresAt),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid.");
  }
}

function assertString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid.");
  }

  return value;
}

function assertUnixTimestamp(value: unknown): number {
  if (!Number.isInteger(value) || typeof value !== "number") {
    throw new AppError(401, "INVALID_PREVIEW_TOKEN", "Preview token is invalid.");
  }

  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

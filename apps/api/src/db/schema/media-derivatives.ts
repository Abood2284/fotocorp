export const MEDIA_DERIVATIVE_VARIANTS = ["thumb", "card", "detail"] as const;
export const MEDIA_DERIVATIVE_STATUSES = ["READY", "STALE", "FAILED"] as const;
export const MEDIA_ACCESS_OUTCOMES = [
  "SERVED",
  "NOT_FOUND",
  "PREVIEW_NOT_READY",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_TOKEN",
  "R2_ERROR",
] as const;

export type MediaDerivativeVariant = (typeof MEDIA_DERIVATIVE_VARIANTS)[number];

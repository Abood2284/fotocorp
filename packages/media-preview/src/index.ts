/**
 * Worker-safe entry: profile constants and helpers only (no Sharp).
 * Node CLIs and apps/jobs must import `@fotocorp/media-preview/generate` for image encoding.
 */
export * from "./profiles"

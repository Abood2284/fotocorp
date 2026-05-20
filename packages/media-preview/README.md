# @fotocorp/media-preview

Shared protected preview policy and Sharp-based WebP generation.

## Import paths (important)

| Import | Runtime | Contains Sharp? |
|--------|---------|-----------------|
| `@fotocorp/media-preview` or `.../profiles` | Cloudflare Worker, browser-safe code | **No** |
| `@fotocorp/media-preview/generate` | Node only (`tsx`, VPS Docker jobs) | **Yes** |

**Cloudflare API Worker** must only use the profiles entry (see `apps/api/src/lib/media/watermark.ts`).

**Node scripts** (`media:generate-derivatives`, `media:process-image-publish-jobs`) and **apps/jobs** use `./generate` for `generateProtectedPreview` / `decodePreviewSource`.

After the protected-preview backfill is complete, this split can stay (recommended) or profiles can be inlined back into `apps/api` if you remove the shared package.

# 05 - Download Size Derivatives

## Feature Name

Download Size Derivatives

## Status

Approved direction for implementation.

## Purpose

Fotocorp needs to show three download options for every image:

- Small
- Medium
- Large

Large will serve the original image already stored in Cloudflare R2.

Small and Medium must not be permanently pre-generated for the entire catalog upfront. Instead, they should be generated on first demand, stored as reusable derivatives, and streamed from storage on future download requests.

This keeps storage usage controlled while still giving users fast repeated downloads after the first generation.

## Product Requirement

Each image detail page must expose three clear download options.

| Option | Source | User-facing meaning |
|---|---|---|
| Small | Generated derivative | Low-resolution licensed file |
| Medium | Generated derivative | Practical web/editorial licensed file |
| Large | Original R2 object | Full original image |

The user should not need to understand the technical difference. They should only see clean size choices with useful labels.

## Recommended Size Presets

### Small

```txt
Max long edge: 600 px
DPI metadata: 72 dpi
Format: JPG
Quality: 75-80
Watermark: No, for entitled paid downloads
```

### Medium

```txt
Max long edge: 1600 px
DPI metadata: 300 dpi
Format: JPG
Quality: 84-88
Watermark: No, for entitled paid downloads
```

### Large

```txt
Dimensions: Original image dimensions
DPI metadata: Original metadata if available, otherwise keep as-is
Format: Original format if possible
Quality: Original quality
Watermark: No, for entitled paid downloads
```

## Why Medium Should Be 1600 px Instead of 1024 px

Getty-style medium sizing often uses around 1024 px width. Fotocorp can use that model, but 1024 px is now quite limited for real-world website, blog, social, and editorial use.

A 1600 px medium download gives users a more practical licensed file without giving away the full original.

Recommended final decision:

```txt
Small  = max long edge 600 px
Medium = max long edge 1600 px
Large  = original
```

If the client wants stricter Getty-like segmentation, Medium can be reduced to 1024 px later.

## Meaning of Pixel, DPI, Print Size, and Megapixels

### Pixels

Pixels are the actual usable size of the image.

Example:

```txt
4000 x 2842 px = 11,368,000 total pixels
```

This is the most important value for digital usage.

### DPI / PPI

DPI is print-density metadata.

It tells print/design software how many pixels should fit into one inch.

It does not add quality.

Example:

```txt
1024 px at 300 dpi = 3.41 inches wide
3.41 inches x 2.54 = 8.67 cm wide
```

The same 1024 px image at 72 dpi would appear larger in print software but would still only contain 1024 pixels of image data.

### Print Size

Print size is calculated from pixels and DPI.

Formula:

```txt
print width in inches = pixel width / dpi
print width in cm = (pixel width / dpi) x 2.54
```

### Megapixels

Megapixels are calculated from width and height.

Formula:

```txt
megapixels = (width x height) / 1,000,000
```

Example:

```txt
4000 x 2842 = 11,368,000 pixels
= 11.4 MP
```

## Assumptions

The implementation assumes the following:

1. Originals are already stored in Cloudflare R2.
2. Original files are the canonical source of truth.
3. Original files must not be renamed or modified.
4. Browser/client must never receive direct R2 credentials.
5. Downloads must be controlled through backend entitlement checks.
6. Small and Medium derivatives should be clean licensed downloads, not watermarked previews.
7. Public preview/card/detail images remain separate from licensed download derivatives.
8. The backend database already has or will have asset records that can resolve an asset ID to its original R2 key.
9. The system should log all successful and failed download attempts.
10. The system should avoid processing images repeatedly for the same requested derivative.
11. The system should tolerate missing derivatives by generating them when needed.
12. The system should avoid blocking user-facing requests for too long while generating derivatives.
13. Cloudflare Workers should not be treated as the image-processing runtime for Sharp/libvips work.
14. A Node-capable job worker or server-side generation process should handle Sharp processing.
15. If the original is smaller than the requested derivative size, the system must not upscale it.

## Non-Goals

This feature does not include:

- AI/semantic image search.
- New subscription pricing rules.
- Public free sample downloads.
- Reworking existing preview thumbnails.
- Rebuilding the entire media ingestion pipeline.
- Pre-generating Small and Medium for the full image catalog.
- Replacing the original image storage strategy.
- Changing legacy image IDs, Fotokey, or original object keys.
- Adding image editing/cropping tools.
- Adding user-selected custom dimensions.

## Architecture Decision

Use lazy derivative generation with persistent caching.

```txt
User clicks Download Small/Medium
        ↓
Backend validates session, entitlement, and quota
        ↓
Backend checks derivative table/storage
        ↓
If derivative exists and is READY:
        stream derivative from R2
        log successful download
        decrement quota if applicable
        ↓
If derivative does not exist:
        create derivative generation job
        return controlled "preparing download" response
        OR generate through a safe backend job path
        ↓
Job reads original from R2
        ↓
Job generates derivative using Sharp
        ↓
Job stores derivative in R2
        ↓
Job marks derivative READY in DB
        ↓
Next request streams generated derivative
```

## Storage Model

Keep originals as canonical objects.

Generated derivatives should be stored separately using deterministic R2 keys.

Example key pattern:

```txt
derivatives/downloads/{assetId}/small.jpg
derivatives/downloads/{assetId}/medium.jpg
```

Alternative using Fotokey:

```txt
derivatives/downloads/{fotokey}/small.jpg
derivatives/downloads/{fotokey}/medium.jpg
```

Recommended:

```txt
Use internal asset_id in storage paths.
Keep Fotokey as business metadata, not storage-path dependency.
```

Reason:

- Asset ID is stable inside the new system.
- Fotokey may have business formatting or legacy quirks.
- Storage paths should not depend on user-facing identifiers unless already guaranteed safe.

## Preview vs Download Separation

Do not confuse preview derivatives with download derivatives.

### Preview Images

Preview images are for browsing/search/detail pages.

They may be:

- Watermarked
- Lower quality
- WebP
- Public or semi-public
- CDN/cache optimized

### Download Images

Download images are licensed user deliverables.

They should be:

- Clean
- Access-controlled
- Logged
- Quota-aware
- Generated only after entitlement validation
- Stored separately from previews

## Recommended Derivative Variants

Existing preview variants may include:

```txt
thumb
card
detail
```

New download variants should be separate:

```txt
download_small
download_medium
```

Large does not need a generated derivative because it uses the original.

## API Design

### User-facing Download Endpoint

```txt
GET /api/assets/:assetId/download?size=small
GET /api/assets/:assetId/download?size=medium
GET /api/assets/:assetId/download?size=large
```

Allowed size values:

```txt
small
medium
large
```

Invalid values must return a controlled validation error.

### Internal API Behavior

The download endpoint should:

1. Validate `assetId`.
2. Validate `size`.
3. Validate user session.
4. Validate subscription or entitlement.
5. Validate quota.
6. Resolve asset record.
7. Resolve original R2 key.
8. For Large, stream the original if allowed.
9. For Small/Medium, check derivative status.
10. If derivative is READY, stream it.
11. If derivative is missing, queue generation.
12. Return a controlled pending/preparing response.
13. Log all outcomes.

## Response Behavior

### Derivative Exists

Return file stream.

```txt
HTTP 200
Content-Type: image/jpeg
Content-Disposition: attachment; filename="{fotokey}-medium.jpg"
```

### Derivative Missing but Job Queued

Recommended response:

```json
{
  "ok": false,
  "code": "DOWNLOAD_DERIVATIVE_PREPARING",
  "message": "Your download is being prepared. Please try again shortly."
}
```

### Derivative Generation Failed

Recommended response:

```json
{
  "ok": false,
  "code": "DOWNLOAD_DERIVATIVE_FAILED",
  "message": "This download size could not be prepared. Please try another size or contact support."
}
```

### Large Original Missing

Recommended response:

```json
{
  "ok": false,
  "code": "ORIGINAL_NOT_FOUND",
  "message": "The original file for this asset could not be found."
}
```

## Database Design

### Asset Derivatives Table

If not already present, create or extend a derivative table.

```sql
create table asset_derivatives (
  id text primary key,
  asset_id text not null,
  variant text not null,
  width_px integer,
  height_px integer,
  dpi integer,
  format text,
  quality integer,
  r2_key text,
  file_size_bytes bigint,
  status text not null,
  error_code text,
  error_message text,
  generated_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
```

Recommended variants:

```txt
thumb
card
detail
download_small
download_medium
```

Recommended statuses:

```txt
MISSING
PROCESSING
READY
FAILED
```

Recommended unique constraint:

```sql
unique(asset_id, variant)
```

### Download Logs Table

Downloads should be logged separately from derivative generation.

```sql
create table asset_download_logs (
  id text primary key,
  asset_id text not null,
  user_id text not null,
  download_size text not null,
  derivative_id text,
  width_px integer,
  height_px integer,
  file_size_bytes bigint,
  quota_before integer,
  quota_after integer,
  r2_key text,
  status text not null,
  error_code text,
  created_at timestamp not null default now()
);
```

Recommended download sizes:

```txt
small
medium
large
```

Recommended statuses:

```txt
SUCCESS
FAILED
BLOCKED
PREPARING
```

## Sharp Processing Rules

Use Sharp only in a Node-compatible backend/job environment.

### Small Preset

```ts
const smallPreset = {
  maxLongEdge: 600,
  dpi: 72,
  quality: 78,
  format: "jpeg",
}
```

### Medium Preset

```ts
const mediumPreset = {
  maxLongEdge: 1600,
  dpi: 300,
  quality: 86,
  format: "jpeg",
}
```

### Resize Behavior

Use aspect-ratio-preserving resize.

```ts
.resize({
  width: preset.maxLongEdge,
  height: preset.maxLongEdge,
  fit: "inside",
  withoutEnlargement: true,
})
```

Do not use crop/cover for editorial images.

Bad:

```txt
fit: cover
```

Why bad:

- Can crop faces.
- Can crop logos.
- Can remove event context.
- Can damage editorial integrity.

Good:

```txt
fit: inside
```

Why good:

- Preserves the complete image.
- Preserves original orientation.
- Keeps editorial value intact.

### DPI Metadata

Set DPI metadata on output where useful.

```ts
.withMetadata({
  density: preset.dpi,
})
```

Important:

DPI metadata does not improve visual quality. It only affects print/layout interpretation in some tools.

## Cloudflare Workers Warning

Do not assume Sharp can run inside a normal Cloudflare Worker request.

Sharp depends on native image-processing capabilities through libvips. Cloudflare Workers are not a general Node.js server runtime.

Recommended split:

```txt
Cloudflare Worker API:
- Auth check
- Entitlement check
- Quota check
- DB read/write
- R2 read/write
- Stream existing files
- Queue derivative jobs

Node-compatible job processor:
- Reads original from R2
- Uses Sharp
- Generates Small/Medium
- Uploads derivative to R2
- Updates DB status
```

## Possible Implementation Models

### Option A - Fully Synchronous Generation

```txt
User requests Medium
API generates Medium immediately
API streams file
```

Avoid for production unless image generation is guaranteed fast and runtime-compatible.

Risks:

- Request timeout.
- High CPU usage.
- Poor user experience on large originals.
- Cloudflare Worker compatibility issues.
- Duplicate processing under concurrent requests.

### Option B - Async Job Generation

```txt
User requests Medium
API queues job
User sees "preparing download"
Job generates derivative
User retries/downloads when ready
```

Recommended for reliability.

Risks:

- Slight delay on first download.
- Requires job queue/status handling.
- UI needs pending state.

### Option C - Generate On First Demand with Locking

```txt
User requests Medium
API checks derivative
If missing, acquire generation lock
One worker generates it
Other requests wait or receive preparing response
```

Best long-term model.

Risks:

- More engineering complexity.
- Requires idempotency and locking.
- Needs stale lock recovery.

## Recommended Final Model

Use Option C where possible, implemented in stages.

### Stage 1

Queue derivative generation when missing.

Return:

```txt
DOWNLOAD_DERIVATIVE_PREPARING
```

### Stage 2

Add polling/retry UX.

### Stage 3

Add generation locking and stale lock recovery.

### Stage 4

Optionally pre-generate derivatives for popular assets, newly imported assets, or admin-selected collections.

## Concurrency Risks

Multiple users may request the same missing derivative at the same time.

Bad outcome:

```txt
10 users request medium
10 jobs generate the same medium file
10 writes happen to R2
DB status may race
```

Required protection:

```txt
Before queueing/generating:
- Check asset_derivatives for existing READY row
- Check PROCESSING row
- If PROCESSING exists, do not create duplicate job
- If FAILED exists, allow retry only under controlled policy
```

Recommended DB behavior:

```txt
unique(asset_id, variant)
```

Then use an upsert or transaction-safe insert.

## Failure Modes and What to Avoid

### 1. Processing Inside the Wrong Runtime

Problem:

Cloudflare Worker request tries to use Sharp directly.

Result:

- Build/runtime failure.
- Missing native dependencies.
- Timeout.
- Broken downloads.

Avoid by:

- Keeping Sharp inside a Node-compatible worker/job.
- Letting Cloudflare Worker orchestrate, not process.

### 2. Reprocessing on Every Download

Problem:

Every Small/Medium click regenerates the file.

Result:

- Wasteful CPU usage.
- Slow downloads.
- Higher operational cost.
- More failure points.

Avoid by:

- Saving generated derivatives to R2.
- Marking derivative as READY.
- Streaming existing derivative on future requests.

### 3. Pre-generating Everything Too Early

Problem:

Generate Small/Medium for 700k+ or 1M images upfront.

Result:

- Huge processing time.
- More storage usage.
- More operational complexity.
- Many useless derivatives for images nobody downloads.

Avoid by:

- Generating on first demand.
- Batch-generating only popular/priority assets later.

### 4. Upscaling Small Originals

Problem:

Original is 900 px wide and Medium target is 1600 px.

Result:

- Fake enlargement.
- Soft/blurry output.
- User perceives poor quality.

Avoid by:

```txt
withoutEnlargement: true
```

Also show actual generated dimensions in metadata/UI when useful.

### 5. Cropping Editorial Images

Problem:

Using cover/crop resize.

Result:

- Faces cut.
- Event context removed.
- Logos/signage lost.
- Editorial integrity damaged.

Avoid by:

```txt
fit: inside
```

### 6. Mixing Preview and Download Assets

Problem:

Watermarked preview variants are reused as download files.

Result:

- Paid users receive watermarked files.
- Product feels broken.
- Support complaints.

Avoid by:

- Separate preview derivatives and download derivatives.
- Separate R2 paths.
- Separate DB variants.

### 7. Serving Clean Downloads Without Entitlement Checks

Problem:

Download URL exposes clean files without subscription/quota validation.

Result:

- Revenue leakage.
- Copyright risk.
- Users bypass plans.

Avoid by:

- Never exposing raw R2 URLs publicly for clean downloads.
- Always route through authorized backend download endpoint.
- Use signed URLs only if entitlement checks happen before signing and URLs expire quickly.

### 8. Forgetting Download Logs

Problem:

Files are served but no event is recorded.

Result:

- No quota control.
- No analytics.
- No audit trail.
- No customer support visibility.

Avoid by:

- Logging all download attempts.
- Logging both success and failure.
- Including size, asset, user, quota, and error details.

### 9. Decrementing Quota Too Early

Problem:

Quota is deducted before file stream succeeds or before derivative exists.

Result:

- Users lose quota on failed downloads.
- Support disputes.

Avoid by:

- Mark PREPARING without decrementing final quota.
- Decrement only when actual file delivery begins successfully, or define a clear policy.
- Track failed attempts separately.

### 10. No Controlled Error Codes

Problem:

Backend throws generic 500 errors.

Result:

- UI cannot display useful messages.
- Debugging becomes painful.
- Users retry blindly.

Avoid by defining codes:

```txt
INVALID_DOWNLOAD_SIZE
ASSET_NOT_FOUND
ORIGINAL_NOT_FOUND
DERIVATIVE_NOT_READY
DOWNLOAD_DERIVATIVE_PREPARING
DOWNLOAD_DERIVATIVE_FAILED
ENTITLEMENT_REQUIRED
QUOTA_EXCEEDED
INTERNAL_DOWNLOAD_ERROR
```

### 11. No Idempotency in Jobs

Problem:

Repeated queue attempts create duplicate jobs.

Result:

- Duplicate processing.
- Race conditions.
- Inconsistent DB state.

Avoid by:

- Unique derivative row per asset/variant.
- PROCESSING status.
- Job deduplication key.

Example dedupe key:

```txt
download-derivative:{assetId}:{variant}
```

### 12. Bad Filename Generation

Problem:

Downloaded file names are random or expose internal storage paths.

Result:

- Poor user experience.
- Potential leakage of internal object keys.

Avoid by using clean filenames:

```txt
{fotokey}-small.jpg
{fotokey}-medium.jpg
{fotokey}-large.{originalExt}
```

Fallback:

```txt
fotocorp-{assetId}-medium.jpg
```

### 13. MIME Type Mistakes

Problem:

Wrong `Content-Type` header.

Result:

- Browser download issues.
- Corrupt-looking files.
- Incorrect file handling.

Avoid by setting:

```txt
image/jpeg
image/png
image/webp
```

Large/original should preserve original MIME type.

Small/Medium can standardize to JPEG.

### 14. Losing EXIF Orientation

Problem:

Generated image appears rotated incorrectly.

Avoid by:

```ts
.rotate()
```

This applies EXIF orientation before resizing.

### 15. Accidentally Preserving Sensitive Metadata

Problem:

Clean downloads preserve original EXIF/GPS/camera metadata unintentionally.

Result:

- Privacy risk.
- Client/legal concerns.

Decision needed:

```txt
Should Fotocorp preserve EXIF for licensed downloads?
```

Recommended default:

```txt
Strip sensitive metadata from Small/Medium.
For Large, preserve original unless business/legal requires stripping.
```

### 16. R2 Object Key Drift

Problem:

Derivative path does not match DB row.

Result:

- DB says READY but R2 file is missing.
- Download fails.

Avoid by:

- Deterministic key generation.
- Store R2 key in DB.
- On READY stream failure, mark derivative FAILED or MISSING with error code.

### 17. Partial Uploads

Problem:

Job crashes during upload.

Result:

- Corrupt or incomplete derivative object.

Avoid by:

- Upload only complete generated buffer/stream.
- Mark READY only after R2 put succeeds.
- Consider validating file size after upload if practical.

### 18. Large Originals With Unexpected Formats

Problem:

Some originals may be TIFF, PNG, CMYK JPEG, huge JPEG, corrupt files, or unsupported formats.

Result:

- Derivative generation fails for a subset.

Avoid by:

- Logging exact original format and error.
- Marking derivative FAILED, not crashing the whole job.
- Building admin/report view for failed derivatives.

### 19. Memory Pressure on Very Large Images

Problem:

Huge originals are loaded fully into memory.

Result:

- Job crashes.
- Runtime out-of-memory errors.

Avoid by:

- Using stream-based processing where possible.
- Setting worker memory limits appropriately.
- Testing with largest known originals.
- Logging dimensions before processing.

### 20. No Admin Visibility

Problem:

Derivative generation fails silently.

Result:

- Team cannot know what broke.

Avoid by tracking:

```txt
asset_id
variant
status
error_code
error_message
attempt_count
last_attempt_at
generated_at
```

## UI Requirements

On the image detail page, show download options clearly.

Example:

```txt
Download

Small
600 px max | 72 dpi
Best for web preview and reference use

Medium
1600 px max | 300 dpi
Best for websites, editorial, social, and presentations

Large
Original file
Best for print, archive, and full-resolution licensed use
```

If actual original is smaller than the preset, show actual dimensions.

Example:

```txt
Medium
900 x 640 px
Original is smaller than standard medium size
```

## UI Pending State

If derivative is not ready:

```txt
Preparing your download...
This size is being generated for the first time. Please try again shortly.
```

Recommended actions:

- Disable repeated spam clicks briefly.
- Show retry button.
- Optionally poll derivative status.
- Do not deduct quota until file is actually available or delivered.

## Backend Validation Rules

### Validate Size

Allowed:

```txt
small
medium
large
```

Reject anything else.

### Validate Asset

Asset must exist and must not be deleted/disabled.

### Validate Original

Original R2 key must exist before derivative generation.

### Validate Entitlement

User must have active entitlement/subscription/download permission.

### Validate Quota

User must have remaining downloads if plan requires quota.

### Validate Derivative

For Small/Medium:

```txt
asset_id + variant must resolve to READY derivative before streaming
```

If not READY, queue/generate.

## Suggested TypeScript Constants

```ts
export const DOWNLOAD_SIZE_OPTIONS = ["small", "medium", "large"] as const

export type DownloadSize = (typeof DOWNLOAD_SIZE_OPTIONS)[number]

export const DOWNLOAD_DERIVATIVE_PRESETS = {
  small: {
    variant: "download_small",
    maxLongEdge: 600,
    dpi: 72,
    format: "jpeg",
    quality: 78,
  },
  medium: {
    variant: "download_medium",
    maxLongEdge: 1600,
    dpi: 300,
    format: "jpeg",
    quality: 86,
  },
} as const
```

## Suggested Generation Function Shape

```ts
type GenerateDownloadDerivativeInput = {
  assetId: string
  variant: "download_small" | "download_medium"
}

type GenerateDownloadDerivativeResult = {
  assetId: string
  variant: "download_small" | "download_medium"
  widthPx: number
  heightPx: number
  dpi: number
  format: "jpeg"
  fileSizeBytes: number
  r2Key: string
}
```

## Suggested Download Flow Pseudocode

```ts
async function handleAssetDownload(assetId: string, size: DownloadSize, userId: string) {
  validateDownloadSize(size)

  const user = await requireUser(userId)
  const asset = await getAssetOrThrow(assetId)

  await assertUserCanDownload(user, asset)
  await assertQuotaAvailable(user)

  if (size === "large") {
    const original = await getOriginalObject(asset)

    if (!original) {
      await logDownloadFailure({ assetId, userId, size, code: "ORIGINAL_NOT_FOUND" })
      throw new DownloadError("ORIGINAL_NOT_FOUND")
    }

    await logDownloadSuccess({ assetId, userId, size, r2Key: asset.r2OriginalKey })
    return streamOriginal(original)
  }

  const derivative = await getDownloadDerivative(assetId, size)

  if (derivative?.status === "READY") {
    const object = await getR2Object(derivative.r2Key)

    if (!object) {
      await markDerivativeMissing(derivative.id)
      await logDownloadFailure({ assetId, userId, size, code: "DERIVATIVE_OBJECT_MISSING" })
      throw new DownloadError("DOWNLOAD_DERIVATIVE_FAILED")
    }

    await logDownloadSuccess({ assetId, userId, size, r2Key: derivative.r2Key })
    return streamDerivative(object)
  }

  await queueDerivativeGeneration(assetId, size)
  await logDownloadPreparing({ assetId, userId, size })

  throw new DownloadError("DOWNLOAD_DERIVATIVE_PREPARING")
}
```

## Acceptance Criteria

### Product

- Image detail page shows Small, Medium, and Large download options.
- Each option displays understandable size information.
- Large downloads the original file.
- Small and Medium become available through generated derivatives.
- Paid/entitled users receive clean files, not watermarked preview files.
- Non-entitled users cannot download clean files.

### Backend

- Download endpoint validates size.
- Download endpoint validates session.
- Download endpoint validates entitlement.
- Download endpoint validates quota.
- Large streams original from R2.
- Small/Medium stream READY derivatives from R2.
- Missing Small/Medium derivative creates or reuses a generation job.
- Duplicate jobs are avoided.
- Every download attempt is logged.
- Controlled error codes are returned.

### Storage

- Originals remain untouched.
- Small/Medium derivatives are stored separately from previews.
- Derivative R2 keys are deterministic.
- READY status is only set after successful R2 upload.
- Failed generation is visible in DB.

### Processing

- Sharp runs in a Node-compatible job environment.
- Processing preserves aspect ratio.
- Processing does not upscale.
- Processing applies EXIF orientation.
- Processing uses JPEG output for Small/Medium unless a future product rule says otherwise.

### Safety

- Browser never receives R2 secrets.
- Raw clean R2 files are not publicly exposed.
- Failed downloads do not silently deduct quota.
- Generic 500s are avoided where controlled errors are possible.

## Testing Checklist

### Unit Tests

- Validate allowed size values.
- Reject invalid size values.
- Map `small` to `download_small`.
- Map `medium` to `download_medium`.
- Ensure `large` bypasses derivative lookup.
- Ensure resize dimensions preserve aspect ratio.
- Ensure no upscaling occurs.

### Integration Tests

- Entitled user downloads Large successfully.
- Entitled user downloads existing Medium derivative successfully.
- Entitled user requests missing Medium derivative and receives preparing response.
- Non-entitled user is blocked.
- User with exhausted quota is blocked.
- Missing original returns controlled error.
- Missing derivative object marks derivative invalid or failed.
- Duplicate Medium requests do not create duplicate jobs.

### Manual QA

- Download Small from detail page.
- Download Medium from detail page.
- Download Large from detail page.
- Confirm filenames are clean.
- Confirm downloaded image opens properly.
- Confirm Small is around 600 px max long edge.
- Confirm Medium is around 1600 px max long edge.
- Confirm Large matches original dimensions.
- Confirm Small/Medium are not watermarked for paid users.
- Confirm preview images remain watermarked.
- Confirm download logs are created.

## Metrics to Track

Track these over time:

```txt
small_download_count
medium_download_count
large_download_count
derivative_generation_success_count
derivative_generation_failed_count
average_derivative_generation_time
most_downloaded_assets
failed_original_missing_count
quota_blocked_count
entitlement_blocked_count
```

These metrics help decide whether to pre-generate some derivatives later.

## Future Enhancements

Possible future improvements:

1. Pre-generate derivatives for top 1,000 most viewed assets.
2. Add admin action to regenerate derivatives.
3. Add per-plan download-size restrictions.
4. Add one-click download bundle.
5. Add custom license text per downloaded image.
6. Add receipt/license certificate per download.
7. Add CDN caching for derivative downloads after entitlement-safe signing.
8. Add derivative health dashboard.
9. Add retry queue for failed derivatives.
10. Add WebP/AVIF downloads if product demand exists.

## Final Decision

Proceed with:

```txt
Small  = generated on first demand, max long edge 600 px
Medium = generated on first demand, max long edge 1600 px
Large  = original image
```

Use:

```txt
Lazy generation + persistent derivative caching in R2
```

Do not:

```txt
Generate Small/Medium on every download
Pre-generate the entire catalog immediately
Run Sharp directly inside normal Cloudflare Worker request flow
Mix watermarked preview assets with clean paid downloads
Expose clean R2 files without entitlement checks
```

The correct system is:

```txt
Originals stay protected.
Downloads go through entitlement checks.
Small/Medium are generated once, stored, and reused.
Failures are logged with controlled error codes.
The user gets simple size choices.
The backend keeps the business safe.
```

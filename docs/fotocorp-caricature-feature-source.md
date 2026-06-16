# Fotocorp Caricature Feature Source Document

**Project:** Fotocorp  
**Feature:** Caricature asset segment  
**Status:** Finalized MVP direction  
**Document purpose:** This document is the source reference for implementing caricature upload, storage, metadata, database design, preview generation, and Typesense indexing behavior.

## Implementation Index (Micro-PR Sequence)

| PR | Scope | Status |
|---|---|---|
| PR 0 | Feature source doc + public search segmentation rules | Done |
| PR 1 | Drizzle schema: `caricature_categories`, `caricature_assets`, `caricature_derivatives`, `caricature_download_logs` | Done |
| PR 3 | Search page `segment=editorial\|caricature` URL + dropdown scaffold | Done |
| PR 4 | Home hero search always routes to `segment=editorial` | Done |
| PR 2 | Category seed + staff/internal category reads | Planned |
| PR 5 | Typesense caricature index contract | Done |
| PR 6 | Public caricature search API route | Planned |
| PR 7 | Web caricature search client wiring | Planned |
| PR 8–13 | Staff upload, storage, previews, publish UX, downloads, popularity | Planned |

---

## 1. Feature Overview

Fotocorp will support **caricatures** as a separate asset segment from Editorial Images and Videos.

Caricatures are not event albums and should not reuse the editorial event upload model. Editorial images are usually uploaded in batches around an event, with fields such as event name, category, caption, and who is in picture. Caricatures are standalone creative/editorial assets and should be uploaded one at a time.

The caricature feature must support:

- Single-image caricature upload.
- Separate database tables from editorial images and videos.
- Private storage of original caricature artwork.
- Public storage of only heavily blurred preview derivatives.
- Searchable metadata through Typesense.
- Language-based filtering.
- Visible text transcription.
- Optional English translation of visible text.
- Download logging for popularity, reporting, abuse detection, and future analytics.

The central product rule is:

> Public users must never receive the clean caricature file unless they are authorized to download it.

This matters more for caricatures than editorial images because the drawing style and concept itself can be copied or recreated if the public preview exposes too much detail.

---

## 2. Core Product Decisions Finalized

### 2.1 Caricatures are standalone assets

Caricatures should not require an event name.

A caricature may later be grouped into a series, topic, or collection, but that is not required for MVP.

### 2.2 Single upload only

Unlike editorial uploads, caricature upload should be a single-asset flow.

Reason:

- Each caricature has its own headline.
- Each caricature has its own joke/context.
- Each caricature may have unique visible text.
- Each caricature may have different language metadata.
- Each caricature may require individual review.

### 2.3 Credit replaces artist/cartoonist

The field should be named **Credit**, not Artist or Cartoonist.

Reason:

- It keeps the form flexible.
- It can represent artist name, cartoonist name, studio name, agency name, or credited source.
- It avoids needing a separate credit line field.

### 2.4 Credit Line is removed

Do not add a separate `credit_line` field for MVP.

Reason:

- The **Credit** field already handles attribution.
- A generated display pattern can be used later if needed, for example: `© {Credit} / Fotocorp`.

### 2.5 Rights / License Type is removed for now

Do not add a rights/license selector in the MVP upload form.

Reason:

- Licensing can be handled later as a broader Fotocorp entitlement/licensing layer.
- Adding it now increases uploader complexity before business rules are finalized.

### 2.6 Visible Text is the finalized column name

Use **Visible Text** as the user-facing label and database concept.

It means any text visible inside the caricature, including:

- Speech bubbles.
- Labels.
- Signboards.
- Handwritten notes.
- Printed text.
- Political slogans.
- Object labels.
- Any written content that affects search or interpretation.

### 2.7 Translation is allowed, but optional

Uploaders/staff should be allowed to manually enter an English translation of Visible Text.

The field should be optional.

Reason:

- Hindi, Marathi, Urdu, or mixed-language caricatures may still need to appear for English searches.
- Manual translation is safer than relying on OCR or machine translation at MVP stage.
- Caricature text is often handwritten, stylized, slanted, curved, or intentionally distorted, which makes OCR unreliable.

### 2.8 No AI/OCR transcription in MVP

For MVP, transcription and translation should be manually entered by uploader/staff.

AI-assisted OCR/translation can be added later, but it must only produce drafts. Human approval should be required before the text is saved as final searchable metadata.

Recommended future source values:

```ts
visibleTextSource = "MANUAL" | "AI_DRAFT" | "AI_REVIEWED"
visibleTextTranslationSource = "MANUAL" | "AI_DRAFT" | "AI_REVIEWED"
```

For MVP, these source fields are optional and can be skipped.

---

## 3. MVP Upload Field List

### 3.1 Required fields

| Field | User-facing label | Required | Notes |
|---|---|---:|---|
| `image` | Image | Yes | Single caricature file upload. |
| `headline` | Headline | Yes | Main title shown to users. |
| `description` | Description | Yes | Short explanation/context of the joke, issue, or scene. |
| `credit` | Credit | Yes | Artist/cartoonist/studio/source credit. |
| `category` | Category | Yes | Politics, Society, Culture, Sports, Entertainment, International, Business, etc. |
| `language` | Language | Yes | Language used in the visible text, or `No Visible Text`. |
| `visibleText` | Visible Text | Conditional | Required only if language is not `No Visible Text`. |
| `keywords` | Keywords | Yes | Search tags. |
| `depictedSubjects` | Depicted Subjects | Yes | People, places, organizations, countries, communities, monuments, issues, symbols. |
| `publishedAt` | Created / Published Date | Yes | Date relevance for search and sorting. |
| `status` | Status | Yes | Draft, Pending Review, Published, Rejected. |

### 3.2 Optional fields in MVP

| Field | User-facing label | Required | Notes |
|---|---|---:|---|
| `visibleTextTranslationEn` | English Translation | No | Optional manual English translation of Visible Text. |
| `languageOther` | Specify Language | Conditional | Required only when language is `Other`. |

### 3.3 Fields intentionally not included in MVP

| Removed / Deferred Field | Decision | Reason |
|---|---|---|
| Credit Line | Removed | Credit already handles attribution. |
| Rights / License Type | Removed for now | Licensing rules can be added later. |
| Source / Publication | Later | Useful if archiving newspaper/magazine cartoons later. |
| Series / Collection | Later | Useful if recurring themes/artists become important. |
| Sensitivity Flags | Later | Useful, but can be added after MVP if moderation requires it. |
| Internal Review Note | Later | Staff-only workflow enhancement. |
| Alt Text | Later | Useful for accessibility/SEO, but not required for MVP. |
| Topic / Issue | Later | Keywords and depicted subjects cover this for MVP. |
| Location Relevance | Later | Useful as a future filter, not required at launch. |

---

## 4. Language and Visible Text Rules

### 4.1 Language options

Use a controlled enum instead of free text.

Recommended values:

```ts
NO_VISIBLE_TEXT
ENGLISH
HINDI
MARATHI
URDU
MIXED
OTHER
```

User-facing labels:

| Enum | UI Label |
|---|---|
| `NO_VISIBLE_TEXT` | No Visible Text |
| `ENGLISH` | English |
| `HINDI` | Hindi |
| `MARATHI` | Marathi |
| `URDU` | Urdu |
| `MIXED` | Mixed |
| `OTHER` | Other |

### 4.2 Form behavior

| Selected Language | Visible Text behavior | English Translation behavior |
|---|---|---|
| No Visible Text | Hide or disable field. Store as `null`. | Hide or disable field. Store as `null`. |
| English | Show and require Visible Text. | Hide or keep optional. Usually not needed. |
| Hindi | Show and require Visible Text. | Show optional English Translation. |
| Marathi | Show and require Visible Text. | Show optional English Translation. |
| Urdu | Show and require Visible Text. | Show optional English Translation. |
| Mixed | Show and require Visible Text. | Show optional English Translation. |
| Other | Show and require Visible Text. Also require Specify Language. | Show optional English Translation. |

### 4.3 Null handling rules

When there is no visible text:

```ts
language = "NO_VISIBLE_TEXT"
visibleText = null
visibleTextTranslationEn = null
hasVisibleText = false
```

When there is visible text but no translation:

```ts
language = "MARATHI"
visibleText = "<original Marathi text>"
visibleTextTranslationEn = null
hasVisibleText = true
```

When there is visible text and translation:

```ts
language = "MARATHI"
visibleText = "<original Marathi text>"
visibleTextTranslationEn = "<manual English translation>"
hasVisibleText = true
```

Do not store placeholder values such as:

```txt
N/A
NA
null
None
-
No text
```

These values must never be stored in text fields because they can pollute search results.

---

## 5. Storage Architecture

### 5.1 Two-bucket model

Caricatures should use two separate R2 buckets.

| Bucket | Access | Stores |
|---|---|---|
| `fotocorp-caricature-originals` | Private | Original clean uploaded caricature files. |
| `fotocorp-caricature-previews` | Public/CDN-safe | Only blurred preview derivatives. |

This is intentionally separate from editorial images because caricature previews require stronger protection.

### 5.2 Private originals bucket

The private originals bucket stores only the clean uploaded caricature file.

Used for:

- Staff viewing through authenticated routes.
- Licensed customer download after entitlement/access checks.
- Regenerating blurred preview derivatives if needed.

Clean original files must never be exposed through a public URL.

### 5.3 Public previews bucket

The public previews bucket stores only generated blurred derivatives.

Used for:

- Public listing cards.
- Public detail pages.
- Search result thumbnails/previews.

This bucket must never store clean caricature artwork.

---

## 6. Preview Generation Rules

### 6.1 Finalized derivative count

Per caricature, store:

| File | Bucket | Public? | Purpose |
|---|---|---:|---|
| Original | `fotocorp-caricature-originals` | No | Staff view and licensed download. |
| Blurred Card Preview | `fotocorp-caricature-previews` | Yes | Grid/listing/search card preview. |
| Blurred Detail Preview | `fotocorp-caricature-previews` | Yes | Detail page preview. |

Total per caricature:

- 1 original file.
- 2 generated blurred preview derivatives.

No separate staff review derivative is required.

Staff should view the original through authenticated private access.

No separate licensed download derivative is required for MVP.

Authorized licensed customers can download the original from the private bucket after access checks.

### 6.2 Public preview protection

Public caricature previews should be:

- Heavily blurred.
- Low enough resolution to prevent copying.
- Branded with Fotocorp strip/watermark.
- Generated server-side.
- Stored as separate derivative files.

The preview must be destructive and irreversible enough that an artist cannot easily copy or recreate the artwork from the preview.

### 6.3 Do not use browser CSS blur for protection

Do not serve a clean image and blur it using CSS.

Bad approach:

```css
filter: blur(80px);
```

Reason:

- The clean image still reaches the browser.
- Users can inspect the page and access the clean source file.
- This provides visual protection only, not actual asset protection.

Correct approach:

1. Read original from private bucket on backend/job worker.
2. Downscale the image.
3. Apply heavy blur server-side.
4. Add Fotocorp strip/watermark.
5. Export compressed preview derivative.
6. Store only the blurred derivative in the public preview bucket.

### 6.4 Blur strategy

The product requirement is approximately **80%+ blur/protection**.

Implementation should treat this as a protection target, not a literal CSS percentage.

Recommended generation strategy:

- Downscale before blur.
- Apply strong Gaussian blur or equivalent image blur.
- Export at reduced quality.
- Add Fotocorp strip at bottom-right.
- Avoid preserving crisp line details.
- Avoid preserving readable drawing strokes except broad composition/color blocks.

### 6.5 Fotocorp strip placement

Use the same general Fotocorp brand strip pattern as image previews.

For caricatures:

- Place the strip at the bottom-right.
- Make it visible enough to discourage reuse.
- Apply it after blur so the brand strip stays readable.
- Store watermark/strip generation version in derivative metadata if possible.

---

## 7. Proposed Database Design

> Implementation note: actual schema changes should be implemented using the project’s Drizzle schema and migration workflow, not hand-written production SQL.

### 7.1 Main table: `caricature_assets`

Stores the core caricature record and metadata.

Recommended columns:

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID / text id | Yes | Primary key. |
| `headline` | text | Yes | Main title. |
| `slug` | text | Optional | Useful for public URLs later. Unique if used. |
| `description` | text | Yes | Context/explanation. |
| `credit` | text | Yes | Artist/cartoonist/studio/source credit. |
| `category_id` | UUID / text id | Yes | FK to `caricature_categories`. |
| `language` | enum | Yes | `NO_VISIBLE_TEXT`, `ENGLISH`, `HINDI`, `MARATHI`, `URDU`, `MIXED`, `OTHER`. |
| `language_other` | text | Conditional | Required only if language is `OTHER`. |
| `visible_text` | text | Conditional | Required when language is not `NO_VISIBLE_TEXT`. Null otherwise. |
| `visible_text_translation_en` | text | No | Optional manual English translation. Null if not provided. |
| `has_visible_text` | boolean | Yes | Derived from language or visible text. Useful for filtering. |
| `keywords` | text[] / jsonb | Yes | Search tags. |
| `depicted_subjects` | text[] / jsonb | Yes | People, places, organizations, countries, monuments, concepts, issues. |
| `published_at` | timestamp/date | Yes | Date used for display/sorting. |
| `status` | enum | Yes | `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`. |
| `visibility` | enum | Yes | Usually `PRIVATE` before publish, `PUBLIC` after publish. |
| `original_bucket` | text | Yes | Should point to private caricature originals bucket. |
| `original_object_key` | text | Yes | R2 object key for original file. |
| `original_filename` | text | Yes | Original uploaded filename. |
| `mime_type` | text | Yes | Uploaded file MIME type. |
| `file_size_bytes` | bigint | Yes | Original file size. |
| `width` | integer | Optional | Original image width. |
| `height` | integer | Optional | Original image height. |
| `checksum` | text | Optional | For duplicate detection/integrity. |
| `created_by_staff_id` | UUID / text id | Optional | Staff uploader. |
| `updated_by_staff_id` | UUID / text id | Optional | Last staff editor. |
| `created_at` | timestamp | Yes | Record creation time. |
| `updated_at` | timestamp | Yes | Last update time. |
| `published_by_staff_id` | UUID / text id | Optional | Staff member who published. |
| `published_record_at` | timestamp | Optional | Actual publish action timestamp. |
| `deleted_at` | timestamp | Optional | Soft delete if needed. |

### 7.2 Category table: `caricature_categories`

Stores controlled caricature categories.

Recommended columns:

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID / text id | Yes | Primary key. |
| `name` | text | Yes | Example: Politics, Society, Culture. |
| `slug` | text | Yes | URL/filter-safe key. |
| `sort_order` | integer | Optional | Controls UI order. |
| `is_active` | boolean | Yes | Hide inactive categories without deleting. |
| `created_at` | timestamp | Yes | Creation time. |
| `updated_at` | timestamp | Yes | Last update time. |

Initial category suggestions:

- Politics
- Society
- Culture
- Sports
- Entertainment
- International
- Business
- General

### 7.3 Derivatives table: `caricature_derivatives`

Stores generated blurred preview derivative records.

Recommended derivative types:

```ts
BLURRED_CARD
BLURRED_DETAIL
```

Recommended columns:

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID / text id | Yes | Primary key. |
| `caricature_id` | UUID / text id | Yes | FK to `caricature_assets.id`. |
| `derivative_type` | enum | Yes | `BLURRED_CARD` or `BLURRED_DETAIL`. |
| `bucket` | text | Yes | Public preview bucket. |
| `object_key` | text | Yes | Preview object key. |
| `public_url` | text | Optional | Can be derived if stable URL convention exists. |
| `format` | text | Yes | `webp`, `jpeg`, etc. |
| `width` | integer | Yes | Derivative width. |
| `height` | integer | Yes | Derivative height. |
| `file_size_bytes` | bigint | Optional | Generated file size. |
| `blur_version` | text | Optional | Generation config version. |
| `watermark_version` | text | Optional | Fotocorp strip version. |
| `status` | enum | Yes | `QUEUED`, `GENERATING`, `READY`, `FAILED`. |
| `error_message` | text | Optional | Failure reason if generation fails. |
| `generated_at` | timestamp | Optional | When derivative was generated. |
| `created_at` | timestamp | Yes | Record creation time. |
| `updated_at` | timestamp | Yes | Last update time. |

### 7.4 Download logs table: `caricature_download_logs`

Stores every download attempt for auditing, popularity, reporting, and abuse detection.

Recommended columns:

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID / text id | Yes | Primary key. |
| `caricature_id` | UUID / text id | Yes | FK to `caricature_assets.id`. |
| `user_id` | UUID / text id | Optional | Downloading platform user. |
| `customer_id` | UUID / text id | Optional | Customer/subscriber if separate from user. |
| `entitlement_id` | UUID / text id | Optional | Entitlement/subscription/access record. |
| `download_format` | enum/text | Yes | For MVP, likely `ORIGINAL`. |
| `status` | enum | Yes | `STARTED`, `COMPLETED`, `FAILED`. |
| `failure_reason` | text | Optional | Failure reason if applicable. |
| `request_ip_hash` | text | Optional | Hashed IP for privacy-aware audit. |
| `request_country` | text | Optional | Approximate country. |
| `request_region` | text | Optional | Approximate region/state. |
| `request_city` | text | Optional | Approximate city. |
| `request_user_agent` | text | Optional | User agent at download time. |
| `request_cf_ray` | text | Optional | Cloudflare ray id if available. |
| `downloaded_at` | timestamp | Yes | Download attempt timestamp. |
| `created_at` | timestamp | Yes | Record creation time. |

### 7.5 Optional stats table/view: `caricature_stats`

For performance, popularity data can be computed through a view, materialized view, or denormalized stats table.

Recommended fields:

| Column | Type | Notes |
|---|---|---|
| `caricature_id` | UUID / text id | Primary/FK. |
| `download_count` | integer | Count of completed downloads. |
| `last_downloaded_at` | timestamp | Last completed download time. |
| `popularity_score` | numeric/float | Ranking score for popular/trending sorting. |
| `updated_at` | timestamp | Last stats update. |

Buyer-facing UI should not show exact raw download counts at MVP.

Better buyer-facing signals:

- Popular
- Trending
- Frequently Downloaded
- Recently Purchased

Staff can see exact counts internally.

---

## 8. Upload, Publish, and Derivative Flow

### 8.1 Upload flow

1. Staff uploads one caricature image.
2. Backend stores original in private caricature originals bucket.
3. Backend creates `caricature_assets` record with metadata.
4. Backend/job system queues preview generation.
5. Worker generates blurred card and blurred detail derivatives.
6. Worker uploads derivatives to public caricature previews bucket.
7. Worker records derivative rows in `caricature_derivatives`.
8. Asset can be published once metadata and derivatives are valid.

### 8.2 Staff viewing flow

Staff should view the clean original through an authenticated backend route.

Do not generate a separate staff review derivative for MVP.

Access rule:

> Staff can view originals only after authentication and role permission checks.

### 8.3 Public viewing flow

Public users should only see:

- Blurred card preview.
- Blurred detail preview.
- Metadata such as headline, description, credit, category, language, date, and popularity badges.

Public users should never receive original object keys or signed original URLs unless they have download entitlement.

### 8.4 Download flow

1. User requests download.
2. Backend checks entitlement/access.
3. Backend writes `STARTED` log entry.
4. Backend creates controlled private access to original file.
5. On success, backend records `COMPLETED`.
6. On failure, backend records `FAILED` with reason.
7. Stats are updated asynchronously or computed from logs.

---

## 9. Typesense Collection Design

### 9.1 Collection name

Recommended collection:

```txt
caricatures
```

If versioning is used:

```txt
caricatures_v1
```

### 9.2 Typesense document shape

Recommended document:

```json
{
  "id": "caricature_123",
  "headline": "Tourists and the Taj Mahal",
  "description": "A satire on tourist behaviour and public spitting rules.",
  "credit": "Artist Name",
  "category_id": "cat_society",
  "category_name": "Society",
  "language": "ENGLISH",
  "has_visible_text": true,
  "visible_text": "But... but... it says it was fine for spitting",
  "keywords": ["tourists", "taj mahal", "spitting", "public behaviour"],
  "depicted_subjects": ["Indian tourists", "Taj Mahal", "public behaviour"],
  "published_at_ts": 1765670400,
  "created_at_ts": 1765670400,
  "status": "PUBLISHED",
  "visibility": "PUBLIC",
  "preview_card_url": "https://media.fotocorp.com/caricatures/card/caricature_123.webp",
  "preview_detail_url": "https://media.fotocorp.com/caricatures/detail/caricature_123.webp",
  "download_count": 12,
  "popularity_score": 7.8
}
```

When translation exists:

```json
{
  "id": "caricature_456",
  "headline": "Stand-up Comedy Satire",
  "description": "A Marathi caricature commenting on speech and comedy.",
  "credit": "Artist Name",
  "category_name": "Culture",
  "language": "MARATHI",
  "has_visible_text": true,
  "visible_text": "<original Marathi visible text>",
  "visible_text_translation_en": "A satire about stand-up comedy and careless speech.",
  "keywords": ["stand-up comedy", "speech", "satire"],
  "depicted_subjects": ["comedian", "public speech", "culture"],
  "published_at_ts": 1765670400,
  "status": "PUBLISHED",
  "visibility": "PUBLIC"
}
```

When there is no visible text:

```json
{
  "id": "caricature_789",
  "headline": "Silent Political Satire",
  "description": "A visual caricature without written text.",
  "credit": "Artist Name",
  "category_name": "Politics",
  "language": "NO_VISIBLE_TEXT",
  "has_visible_text": false,
  "keywords": ["politics", "satire"],
  "depicted_subjects": ["politician", "election"],
  "published_at_ts": 1765670400,
  "status": "PUBLISHED",
  "visibility": "PUBLIC"
}
```

Notice that `visible_text` and `visible_text_translation_en` are omitted when null.

### 9.3 Typesense schema fields

Recommended searchable fields:

| Field | Type | Searchable | Facet/Filter | Sort | Notes |
|---|---|---:|---:|---:|---|
| `id` | string | No | Yes | No | Asset id. |
| `headline` | string | Yes | No | No | Highest search priority. |
| `description` | string | Yes | No | No | Context search. |
| `credit` | string | Yes | Yes | No | Lower search weight; useful filter. |
| `category_id` | string | No | Yes | No | Filter. |
| `category_name` | string | Yes | Yes | No | Search + filter. |
| `language` | string | No | Yes | No | Filter only. |
| `has_visible_text` | bool | No | Yes | No | Filter only. |
| `visible_text` | string | Yes | No | No | Search only if present. |
| `visible_text_translation_en` | string | Yes | No | No | Search only if present. |
| `keywords` | string[] | Yes | Yes | No | Important search field. |
| `depicted_subjects` | string[] | Yes | Yes | No | Important search field. |
| `published_at_ts` | int64 | No | Yes | Yes | Date sort/filter. |
| `created_at_ts` | int64 | No | Yes | Yes | Date sort/filter. |
| `status` | string | No | Yes | No | Staff/system filter. Public query should enforce published. |
| `visibility` | string | No | Yes | No | Public query should enforce public. |
| `preview_card_url` | string | No | No | No | Display only. |
| `preview_detail_url` | string | No | No | No | Display only. |
| `download_count` | int32 | No | Yes | Yes | Internal/admin or popularity sort. |
| `popularity_score` | float | No | Yes | Yes | Popular/trending sort. |

### 9.4 Null indexing rule

Critical rule:

> Null or empty values must not be indexed as searchable text.

Do not send placeholder text to Typesense.

Bad:

```json
{
  "visible_text_translation_en": "null"
}
```

Bad:

```json
{
  "visible_text_translation_en": "N/A"
}
```

Bad:

```json
{
  "visible_text": "No text"
}
```

Good:

```json
{
  "language": "NO_VISIBLE_TEXT",
  "has_visible_text": false
}
```

Good:

```json
{
  "language": "MARATHI",
  "has_visible_text": true,
  "visible_text": "<original Marathi text>"
}
```

If `visible_text_translation_en` is null, omit it from the Typesense document or keep it as an optional field according to the final Typesense schema implementation.

The important point is that searches for terms like `null`, `N/A`, `none`, or `no text` must not return caricatures just because the metadata field was empty.

### 9.5 Search behavior

A query should search across meaningful fields:

- `headline`
- `keywords`
- `depicted_subjects`
- `description`
- `visible_text`
- `visible_text_translation_en`
- `credit` with lower priority

Example:

User searches:

```txt
eating food
```

Results can match caricatures where:

- headline includes eating/food meaning.
- description mentions eating food.
- keywords contain eating/food.
- depicted subjects include eating/food.
- visible text says eating food.
- English translation says eating food.

This allows multilingual caricatures to appear in English searches when staff has provided a translation.

### 9.6 Filter behavior

Filters should narrow search results precisely.

Example:

User searches:

```txt
eating food
```

Then selects:

```txt
Language = Marathi
```

Final result set should include only caricatures where:

```ts
search matches "eating food"
language = "MARATHI"
status = "PUBLISHED"
visibility = "PUBLIC"
```

Recommended public filters:

| Filter | Field | Notes |
|---|---|---|
| Language | `language` | English, Hindi, Marathi, Urdu, Mixed, Other, No Visible Text. |
| Category | `category_id` / `category_name` | Core browsing filter. |
| Credit | `credit` | Useful for artist/cartoonist search. |
| Has Visible Text | `has_visible_text` | Lets users choose text-based or visual-only caricatures. |
| Date | `published_at_ts` | Sort/filter by recency. |
| Depicted Subject | `depicted_subjects` | Useful once normalized enough. |
| Popularity | `popularity_score` / `download_count` | Sort option, not necessarily exact public display. |

Recommended staff-only filters:

| Filter | Field |
|---|---|
| Status | `status` |
| Visibility | `visibility` |
| Missing Translation | Derived from `has_visible_text = true` and missing translation. |
| Missing Visible Text | Derived validation issue. |
| Credit | `credit` |
| Category | `category_id` |
| Language | `language` |

### 9.7 Weighted search priority

To avoid vague or noisy results, fields should not be treated equally.

Recommended priority:

| Priority | Field | Reason |
|---:|---|---|
| 1 | `headline` | Most intentional title signal. |
| 2 | `keywords` | Curated search tags. |
| 3 | `depicted_subjects` | Strong subject/entity signal. |
| 4 | `description` | Context signal. |
| 5 | `visible_text` | Important, but may contain incidental text. |
| 6 | `visible_text_translation_en` | Useful for multilingual search, but still secondary. |
| 7 | `credit` | Useful for artist search, but should not dominate topic search. |

This prevents one random phrase inside the caricature from outranking a better result whose headline, keywords, and subjects are clearly more relevant.

### 9.8 Public query defaults

Every public caricature search must enforce:

```ts
status = "PUBLISHED"
visibility = "PUBLIC"
```

Public search must return only preview URLs from the public blurred preview bucket.

It must never expose:

- Original bucket name if sensitive.
- Original object key.
- Signed original download URL unless authorized.
- Internal review data.
- Failed derivative paths.

### 9.9 Admin/staff search

Staff search can include:

- Draft caricatures.
- Pending review caricatures.
- Rejected caricatures.
- Missing metadata filters.
- Original/private access controls.
- Exact download counts.
- Derivative generation status.

Staff search must still avoid indexing placeholder text values.

---

## 10. Validation Rules

### 10.1 Upload validation

Required:

- Image file must exist.
- Headline must not be empty.
- Description must not be empty.
- Credit must not be empty.
- Category must be valid.
- Language must be valid enum.
- Keywords must have at least one useful value.
- Depicted subjects must have at least one useful value.
- Published date must be valid.

Conditional:

- If language is `NO_VISIBLE_TEXT`, `visibleText` must be null.
- If language is `NO_VISIBLE_TEXT`, `visibleTextTranslationEn` must be null.
- If language is not `NO_VISIBLE_TEXT`, `visibleText` is required.
- If language is `OTHER`, `languageOther` is required.
- `visibleTextTranslationEn` is optional.

### 10.2 Search indexing validation

Before indexing into Typesense:

- Trim all text fields.
- Remove empty strings.
- Remove null optional fields from the document payload.
- Remove invalid placeholder values.
- Normalize keyword arrays.
- Normalize depicted subject arrays.
- Ensure status/visibility rules are correct.
- Ensure preview derivative exists before public indexing.

Suggested placeholder blocklist:

```txt
n/a
na
null
none
-
--
no text
not applicable
```

If these values are submitted, treat them as empty and store null where applicable.

---

## 11. Popularity and Download Tracking

### 11.1 Why downloads must be tracked

Caricature downloads should be tracked from MVP.

Reasons:

- Popularity ranking.
- Buyer confidence.
- Internal reporting.
- Sales insight.
- Abuse detection.
- Customer history.
- Future recommendation systems.

### 11.2 What to show publicly

Do not show exact download counts publicly at MVP.

Better public labels:

- Popular
- Trending
- Frequently Downloaded
- Recently Purchased

This gives buyers a useful signal without exposing exact business numbers.

### 11.3 What staff can see

Staff/admin users can see:

- Exact download count.
- Last downloaded date.
- Downloading customer/user.
- Country/city approximate request metadata.
- Failure rates.
- Abuse patterns.

---

## 12. MVP Summary

### 12.1 Upload fields finalized for MVP

Use these fields:

- Image
- Headline
- Description
- Credit
- Category
- Language
- Visible Text
- English Translation
- Keywords
- Depicted Subjects
- Created / Published Date
- Status

### 12.2 Storage finalized for MVP

Use two buckets:

- Private originals bucket.
- Public blurred previews bucket.

### 12.3 Generated files finalized for MVP

Per caricature:

- 1 original clean private file.
- 1 blurred card preview.
- 1 blurred detail preview.

No separate staff review derivative.

No separate licensed download derivative.

### 12.4 Search finalized for MVP

Search across:

- Headline
- Description
- Keywords
- Depicted Subjects
- Visible Text
- English Translation

Filter by:

- Language
- Category
- Credit
- Has Visible Text
- Date
- Popularity

Null fields must not be indexed as searchable text.

Public search entry points:

- Home hero search → editorial segment only.
- Search page segment dropdown → editorial or caricature (never mixed).

### 12.5 Download tracking finalized for MVP

Create separate caricature download logs.

Use logs for:

- Popularity.
- Reporting.
- Audit.
- Abuse detection.
- Future ranking.

---

## 13. Final Implementation Checklist

### Database

- [ ] Add `caricature_assets` table.
- [ ] Add `caricature_categories` table.
- [ ] Add `caricature_derivatives` table.
- [ ] Add `caricature_download_logs` table.
- [ ] Add optional `caricature_stats` view/table if needed.
- [ ] Add enums for language, status, visibility, derivative type, derivative status, download status.

### Storage

- [ ] Create private caricature originals bucket.
- [ ] Create public caricature previews bucket.
- [ ] Ensure originals are never publicly accessible.
- [ ] Ensure previews contain only blurred derivatives.

### Upload UI

- [ ] Build single-upload caricature form.
- [ ] Add fields listed in MVP field list.
- [ ] Add conditional Visible Text behavior based on language.
- [ ] Add optional English Translation field.
- [ ] Prevent placeholder text values.

### Preview generation

- [ ] Generate blurred card preview.
- [ ] Generate blurred detail preview.
- [ ] Apply Fotocorp strip after blur.
- [ ] Store derivatives in public preview bucket.
- [ ] Store derivative metadata in DB.

### Staff access

- [ ] Allow authenticated staff to view original.
- [ ] Do not generate separate staff review derivative.
- [ ] Add staff filters for status, missing metadata, language, credit, category.

### Public access

- [ ] Show only blurred previews publicly.
- [ ] Enforce `PUBLISHED` and `PUBLIC` on public routes.
- [ ] Never expose original object key or signed URL publicly without entitlement.

### Typesense

- [ ] Create caricatures collection.
- [ ] Index only meaningful fields.
- [ ] Omit null/empty optional fields.
- [ ] Add language/category/credit/hasVisibleText/date filters.
- [ ] Add weighted query priority.
- [ ] Ensure public search returns only published/public records.

### Downloads

- [ ] Add caricature download endpoint.
- [ ] Enforce entitlement/access.
- [ ] Log STARTED/COMPLETED/FAILED.
- [ ] Update/download stats.
- [ ] Use popularity for internal ranking and buyer-facing badges.

### Public search segmentation

- [ ] Home hero search routes to editorial-only search (`segment=editorial`).
- [ ] Search page segment dropdown: Editorial images | Caricatures.
- [ ] Persist segment in URL (`segment=editorial|caricature`).
- [ ] Route editorial segment to existing public asset search.
- [ ] Route caricature segment to caricatures Typesense collection.
- [ ] Hide editorial-only filters/toggles when caricature segment is selected.
- [ ] Add segment routing tests.

---

## 14. Final Decision Record

| Area | Final Decision |
|---|---|
| Upload type | Single upload only. |
| Event linkage | Not required. Caricatures are standalone. |
| Author field | Use `Credit`. |
| Caption field | Use `Description`. |
| Text transcript field | Use `Visible Text`. |
| Translation field | Add optional English Translation. |
| Transcription method | Manual in MVP. AI/OCR later only as draft. |
| Rights/license field | Removed for now. |
| Credit line field | Removed. |
| Buckets | Two buckets: private originals and public blurred previews. |
| Public preview | Server-generated heavy blur + Fotocorp strip. |
| Staff preview | Staff views original privately. No separate derivative. |
| Licensed download | Original private file after entitlement. No separate derivative. |
| Derivatives | Blurred Card Preview and Blurred Detail Preview. |
| Download logs | Required from MVP. |
| Typesense null handling | Null/empty fields must not be indexed as searchable text. |
| Search behavior | Broad search across meaningful metadata, precise filters by language/category/etc. |
| Public search segmentation | Separate segment-scoped search. Home hero = editorial only. Search page dropdown = Editorial images or Caricatures. |
| Homepage search scope | Editorial images only; no caricature results from hero search. |
| Search page segment selector | Revive trailing dropdown (currently static “Editorial images”) with Editorial images + Caricatures. |
| Mixed search | Not allowed in MVP; one segment per query. |

---

## 15. Public Search UX — Segment Isolation

Caricature search must be **segment-scoped**, not mixed into editorial image search by default. Editorial images and caricatures use separate Typesense collections, metadata shapes, filters, and result cards. The public UI must make the active segment explicit and route queries to exactly one segment at a time.

### 15.1 Product rule

> A single search request must query **one asset segment only**: Editorial Images **or** Caricatures — never both in the same result set.

This is separate from the existing search-page **result mode** (`images` vs `events`), which applies only within editorial browsing.

| Concept | Purpose | Values |
|---|---|---|
| `segment` | Which asset catalog to search | `editorial` (default), `caricature` |
| `mode` | Editorial result presentation | `images`, `events` |

When `segment=caricature`, editorial-only concepts such as events, Fotokey, contributor filters, and event browse should not apply.

### 15.2 Home page search — Editorial only

**Location:** `apps/web/src/components/marketing/home-hero.tsx` (search bar above the hero backdrop strip in `hero-backdrop-strip.tsx`).

The homepage hero search is intentionally **Editorial-only**.

Behavior:

- Submitting the home hero search navigates to `/search` with the query.
- The request must **always** resolve to editorial image search.
- Do **not** show a segment dropdown on the home hero search bar.
- Do **not** include caricature results from the homepage entry point.

Recommended navigation target:

```txt
/search?q={query}&segment=editorial
```

If `segment` is omitted on `/search`, default to `editorial` for backward compatibility.

### 15.3 Search page — revive segment dropdown

**Location:** `apps/web/src/app/(marketing)/search/page.tsx` and `apps/web/src/components/search/search-experience.tsx`.

The search page currently renders a static label (`Editorial images`) at the end of the search bar. This must be revived as an **interactive segment selector**.

#### Dropdown options (MVP)

| Value | UI label | Search target |
|---|---|---|
| `editorial` | Editorial images | Existing editorial/public asset Typesense collection and filters |
| `caricature` | Caricatures | New `caricatures` Typesense collection and caricature-specific filters |

Future segments (Video, Royalty Free) are out of scope for this dropdown until those catalogs exist.

#### Interaction rules

- The selected segment is visible at the trailing edge of the search bar (desktop) and accessible on mobile.
- Changing the segment re-runs the current query against the newly selected catalog.
- Segment choice persists in the URL so results, filters, pagination, and share links stay stable.
- Submitting a new query keeps the currently selected segment unless the user changes it.
- When `segment=caricature`:
  - Query the caricatures collection only.
  - Hide or disable editorial-only UI such as the Images/Events toggle and event-centric filters.
  - Show caricature-appropriate filters (language, category, credit, has visible text, date, popularity).
  - Render caricature result cards/detail previews (blurred preview URLs only).
- When `segment=editorial`:
  - Preserve current editorial search behavior, including optional `mode=events`.

#### Recommended URL contract

```txt
/search?q=eating+food&segment=editorial&mode=images
/search?q=politics&segment=caricature&sort=relevance
```

Rules:

- `segment` defaults to `editorial` when missing or invalid.
- Invalid segment values must fall back to `editorial`, not mixed search.
- Changing `segment` should reset segment-incompatible params (for example editorial `eventId` when switching to caricature).

### 15.4 Backend / API behavior

Public search endpoints must accept an explicit segment and route to the correct Typesense collection.

Recommended request shape:

```ts
segment: "editorial" | "caricature"
```

Routing:

| Segment | Typesense collection | Notes |
|---|---|---|
| `editorial` | existing public assets / editorial collection | current behavior |
| `caricature` | `caricatures` (or versioned alias) | enforce `status=PUBLISHED`, `visibility=PUBLIC` |

Never merge editorial and caricature hits into one ranked list for MVP.

### 15.5 Typesense implications

Editorial and caricature documents must remain in **separate collections**.

Caricature public search must follow Section 9 rules:

- Search headline, description, keywords, depicted subjects, visible text, English translation, credit.
- Filter by language, category, credit, has visible text, date, popularity.
- Return only blurred preview URLs.
- Omit null/empty optional text fields from indexed/searchable payloads.

Editorial search behavior stays unchanged when `segment=editorial`.

### 15.6 UX copy

| Surface | Copy |
|---|---|
| Home hero placeholder | Keep editorial-focused (for example “AI-enabled search across 1M+ images”). |
| Search page segment default | Editorial images |
| Search page segment option | Caricatures |
| Caricature empty state | Segment-specific messaging (for example “No caricatures matched your search.”) |

### 15.7 Search segmentation checklist

- [ ] Home hero search always routes to editorial-only search.
- [ ] Add `segment` URL param with default `editorial`.
- [ ] Replace static “Editorial images” label with interactive segment dropdown on search page.
- [ ] Wire dropdown changes to URL updates and query re-fetch.
- [ ] Route `segment=editorial` to existing editorial Typesense search.
- [ ] Route `segment=caricature` to caricatures Typesense collection.
- [ ] Hide editorial-only controls when caricature segment is active.
- [ ] Show caricature-specific filters when caricature segment is active.
- [ ] Ensure shareable URLs preserve segment selection.
- [ ] Add tests for segment routing, defaults, and param reset behavior.

---

## 16. Non-Negotiables

1. Do not publicly serve clean caricature artwork.
2. Do not use CSS blur as the protection layer.
3. Do not index placeholder/null text values into Typesense.
4. Do not require translation, but allow it.
5. Do not create unnecessary extra clean derivatives.
6. Do not reuse editorial event upload flow for caricatures.
7. Do not show raw public download counts unless intentionally approved later.
8. Do not expose original object keys or signed original URLs without entitlement checks.
9. Do not mix editorial and caricature results in a single public search response.
10. Do not allow homepage hero search to query caricatures; homepage search is editorial-only.


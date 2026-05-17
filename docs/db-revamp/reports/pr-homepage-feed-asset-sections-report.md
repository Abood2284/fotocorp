# PR: Consolidate homepage asset sections into public homepage feed

## Summary

Extended `GET /api/v1/public/homepage` to return `newestAssets` (50) and `editorialSections` (News/Sports/Entertainment/Retro, 15 each) alongside `latestEvents`. Homepage SSR now performs a single feed request instead of five separate `listPublicAssets` calls.

## API

- `apps/api/src/lib/assets/public-homepage-assets.ts` — limited asset queries without `COUNT(*)`, same full-text `q` matching as public list, stable `/api/media/assets/:id/preview/card` URLs.
- `apps/api/src/lib/assets/public-homepage.ts` — parallel fetch for events + newest + four editorial slices.
- `apps/api/drizzle/0031_image_assets_public_newest_idx.sql` — partial index for newest public assets.

## Web

- `page.tsx` — only `fetchPublicHomepageFeed()`.
- `home-category-section.tsx` — maps feed sections to `PublicAssetCard` / `PublicAssetMosaic`; section-level unavailable copy when feed fails.

## Verification (local, API `:8787`)

| Check | Result |
|---|---|
| `pnpm --dir apps/api check` | pass |
| `pnpm --dir apps/api smoke:hono-routes` | pass |
| `pnpm --dir apps/web build` | pass |
| Homepage feed latency (single call) | ~2–5s typical (vs 6 parallel SSR catalog calls + timeouts) |

```bash
curl -s http://127.0.0.1:8787/api/v1/public/homepage | jq '{events: (.latestEvents|length), newest: (.newestAssets|length), sections: [.editorialSections[] | {key, count: (.items|length)}]}'
```

Expected logs include `newestAssetsCount`, `newsCount`, `sportsCount`, `entertainmentCount`, `retroCount`, `basis: created_at`.

## Before / after SSR

| Before | After |
|---|---|
| 1× homepage feed + 5× `listPublicAssets` (each with `COUNT(*)`) | 1× homepage feed |
| Risk of partial abort/timeouts on asset slices | Single structured `fetchPublicHomepageFeed()` result |

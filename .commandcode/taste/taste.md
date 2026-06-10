# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# ui-patterns
- Board picker for "Save As" should be a dialog or sidebar (not a popover/dropdown, not a centered modal). Include board list, search, and create-new-board option. Confidence: 0.65
- Anonymous users must be able to access and use Fotobox (via localStorage boards). Header Fotobox link must not redirect to sign-in for unauthenticated users. Confidence: 0.80
- Fotobox page for non-signed-in users must include a back button and logo (consistent with signed-in UX). Confidence: 0.70

# terminology
- Use "contributor" not "photographer" in routes, API, DB, and UI. Confidence: 0.85
- Use "staff" not "admin" for internal dashboard users. Confidence: 0.85
- Use "Fotobox" not "Fotoboard" for the save/board functionality. The folder grouping system is called Fotobox (like Getty calls them "boards"). Confidence: 0.70

# schema
- The "title" column in image_assets is renamed to "who_is_in_picture". Confidence: 0.85
- The "legacy_image_code" column should be renamed to "fotokey" and all API reads should use fotokey. Confidence: 0.80
- The "headline" column in image_assets is redundant (same as event name) and should be removed. Confidence: 0.75

# db-migrations
- Do NOT manually create or edit raw .sql migration files. Update Drizzle .ts schema files first, then run `pnpm run db:generate` to generate the SQL migration, then `pnpm run db:migrate` to apply it. Only the Drizzle-generated migration is allowed. Confidence: 0.85

# performance
- Homepage (GET /) SSR must not block on /api/v1/assets or any DB-heavy aggregate query. Use precomputed projection tables (e.g., public_homepage_hero_sets) or client-loaded endpoints instead. Confidence: 0.80
- Filter/facets endpoints should default to includeCounts=false. Expensive COUNT(*) / GROUP BY aggregation over image_assets must not run during SSR or eagerly on page load. Confidence: 0.75

# infrastructure
- Use Cloudflare Tunnel (cloudflared) with ingress rules to expose internal VPS services (jobs worker, Typesense) securely via custom hostnames instead of opening ports directly. Confidence: 0.70

# workflow
See [workflow/taste.md](workflow/taste.md)
# code-style
- Replace all phosphor-icons imports with lucide icons across the codebase. Confidence: 0.75
- Use fotocorp-logo.svg from apps/web/public/images/ in header and footer components. Confidence: 0.75

# media-pipeline
- Thumb and card derivatives must be clean (no watermark). Only detail derivative must remain watermarked. Confidence: 0.85
- R2 preview object keys must use fotokey/legacyImagecode (not DB UUID asset.id). Derive from legacy_imagecode or original R2 filename stem. Confidence: 0.70

# communication
- Use plain, non-technical English when explaining issues to the user. Avoid jargon unless necessary. Confidence: 0.80

# search
- Typesense query_by must use event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey. Do NOT index title (duplicates event_title). Confidence: 0.80

# cloudflare-workers
- Enable nodejs_compat compatibility flag in wrangler.jsonc for Better Auth (requires node:async_hooks). Confidence: 0.75
- Verify npm packages are Cloudflare Workers compatible before using them. Prefer Workers-native APIs (crypto.randomUUID, fetch for DNS-over-HTTPS) over Node-specific modules. Confidence: 0.70

# communication
- Use plain, non-technical English when explaining fixes and concepts. Avoid jargon unless the user signals technical comfort. Confidence: 0.75

# branding
- Use fotocorp.com as the default domain, not fotocorp.in. Confidence: 0.75

# workflow
- When tsx fails with IPC sandbox error (EPERM), use Neon MCP direct SQL for DB validation instead. Confidence: 0.70
- Root pnpm lint does not exist in this monorepo. Do not treat as failure or create it. Confidence: 0.80
- After db:generate, rewrite the generated Drizzle SQL migration to add IF NOT EXISTS clauses, guarded FK creation, backfill CTEs, and migration-time validation DO blocks. Confidence: 0.70

# db
- DB validation scripts use dotenv + pg Pool directly (not Drizzle ORM) to connect to Neon for read-only validation queries. Confidence: 0.70
- Verify Drizzle FK column types match actual Neon DB column types before generating migrations (e.g., app_user_profiles.id is text not uuid). Confidence: 0.70

# architecture
- Client components must call API through same-origin web proxy routes, not directly to the cross-origin API base URL. Use typeof window === "undefined" to detect server vs client for path selection. Confidence: 0.70

# auth
- Validation routes (e.g., POST /api/v1/auth/business-email/validate) are UX-only pre-checks. The actual enforcement must happen in the BetterAuth before hook — never rely on the public route as the security boundary. Confidence: 0.80

# design-tokens
- Avoid the yellowish accent color (--accent: #c07c0a / amber tones) in UI. Use the light shade palette from the design token system instead: primary (navy #1a2540), muted (#ede9e0), surface-warm (#faf8f5), and accent-soft (light amber #fdf4e3 with soft foreground) for subtle highlights. Confidence: 0.80
- Staff/internal dashboard pages use a blue-tinted palette (staff-50 through staff-950) derived from the brand navy (#1a2540), replacing the warm-gray jumbo-* scale. Lighter shades for surfaces/backgrounds, darker shades (staff-900/950, primary navy) for text, active states, and CTAs. Confidence: 0.70

# nextjs
- When using createPortal in Next.js "use client" components, guard against SSR by checking for document existence or using a mounted state before referencing document.body, since document is undefined during server-side rendering. Confidence: 0.70

# client-data
- Use TanStack Query for client-side data fetching with staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, and placeholderData: keepPreviousData for paginated queries. Auth/session queries use staleTime: 5 * 60_000, gcTime: 10 * 60_000, retry: false. Confidence: 0.70

# migrations
- Never manually create or edit raw .sql migration files. Always update Drizzle .ts schema files first, then run pnpm run db:generate to generate the SQL migration, then pnpm run db:migrate to apply it. Confidence: 0.85

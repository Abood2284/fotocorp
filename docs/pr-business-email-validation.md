# PR Notes: Business Email Signup Validation

## Files Changed

- `apps/api/src/modules/auth/businessEmailValidation.ts`: validation service, hardcoded exact email allowlist, starter free/disposable domain lists, override ordering, DNS-over-HTTPS MX check, and cache rules.
- `apps/api/src/routes/hono/authValidationRoutes.ts` and `apps/api/src/honoApp.ts`: public UX pre-validation route at `POST /api/v1/auth/business-email/validate`.
- `apps/api/src/auth/auth.ts`: Better Auth `/sign-up/email` before hook now enforces the same business-email validation service before username validation.
- `apps/api/src/db/schema/auth-email-domain-checks.ts`: domain verdict cache table.
- `apps/api/src/db/schema/auth-email-domain-overrides.ts`: domain allow/block override table.
- `apps/api/src/db/schema/auth-email-address-overrides.ts`: exact email allow/block override table.
- `apps/api/drizzle/0009_business_email_validation.sql`: reproducible migration for the new auth validation tables.
- `apps/api/src/modules/auth/businessEmailValidation.test.ts`: focused validation unit tests.
- `context/architecture.md`, `context/progress-tracker.md`, `apps/api/docs/api-routing-audit.md`, and `apps/api/README.md`: route and architecture notes.

## Validation Behavior

- Exact hardcoded allowlist includes `abdulraheemsayyed22@gmail.com` and runs before free-domain blocking.
- Email/domain overrides win before cached verdicts and static domain blocks.
- Free and disposable starter lists are internal and isolated behind service functions for later expansion.
- MX checks use Cloudflare DNS-over-HTTPS, not Node DNS APIs.
- Cache TTLs:
  - `ALLOW`: 7 days
  - `BLOCK_FREE_EMAIL`: 30 days
  - `BLOCK_DISPOSABLE_EMAIL`: 30 days
  - `BLOCK_NO_MX`: 1 day

## Development DB

Applied to Neon `Development` branch only (`br-steep-sun-ao0nw2cc`):

- `auth_email_domain_checks`
- `auth_email_domain_overrides`
- `auth_email_address_overrides`

Better Auth auth tables remained empty after the migration:

```text
user: 0
account: 0
session: 0
verification: 0
```

## Verification

- `npx tsx --test apps/api/src/modules/auth/businessEmailValidation.test.ts`: passed, 9 tests.
- `npm --prefix apps/api run check`: passed.
- `npm --prefix apps/api run smoke:hono-routes`: passed.
- `npm --prefix apps/web run build`: passed.

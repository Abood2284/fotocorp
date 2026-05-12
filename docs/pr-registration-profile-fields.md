# PR: Persist Fotocorp registration profile fields after signup

## Files Changed

- `apps/api/src/db/schema/fotocorp-user-profiles.ts`: adds the product profile table schema.
- `apps/api/drizzle/0010_fotocorp_user_profiles.sql`: adds the additive profile-table migration.
- `apps/api/src/modules/auth/fotocorpRegistrationProfile.ts`: validates signup profile fields, calls business-email validation, inserts/fetches profiles, and maps current-user profile DTOs.
- `apps/api/src/auth/auth.ts`: validates registration profile fields in the Better Auth `/sign-up/email` before hook and creates the profile in the Better Auth user create after hook.
- `apps/api/src/routes/hono/authProfileRoutes.ts`: adds `GET /api/v1/auth/me`.
- `apps/api/src/honoApp.ts`: mounts auth profile routes.
- `apps/api/src/modules/auth/fotocorpRegistrationProfile.test.ts`: covers profile validation and current-user DTO mapping.
- `apps/api/docs/api-routing-audit.md`, `apps/api/README.md`, `context/architecture.md`, `context/progress-tracker.md`: document route ownership and profile storage.

## Database

- Migration applied to Neon `Development` branch only: `br-steep-sun-ao0nw2cc`.
- Table created: `public.fotocorp_user_profiles`.
- Foreign key decision: `user_id` references Better Auth `public."user"(id)` because the current API Drizzle schema and inspected Development schema both use text IDs for Better Auth users.
- Initial profile rows after migration: `0`.

## Validation Behavior

- Required fields are checked before Better Auth user creation.
- `username` is normalized with the existing Fotocorp username rules.
- `companyEmail` is validated by the internal business-email validation service. If `companyEmail` is not supplied, signup `email` is used.
- `companyType` must be one of: `agency`, `brand`, `broadcaster`, `education`, `government`, `media`, `newsroom`, `non_profit`, `photo_agency`, `publisher`, `other`.
- `jobTitle: "Other"` requires `customJobTitle`.

## Verification

- Targeted tests:
  - `npx tsx --test apps/api/src/modules/auth/businessEmailValidation.test.ts apps/api/src/modules/auth/fotocorpRegistrationProfile.test.ts`
  - Result: 15 passing tests.
- API type check:
  - `npm --prefix apps/api run check`
  - Result: passed.
- Neon Development schema verification:
  - Confirmed all requested `fotocorp_user_profiles` columns exist.
  - Confirmed requested indexes exist.
  - Confirmed FK references Better Auth `public."user"`.
  - Confirmed profile row count is `0` immediately after migration.

## Mailer TODO

- Existing TODO remains: Better Auth email verification and password reset email delivery are isolated in auth config but still need a production mailer before being enabled.

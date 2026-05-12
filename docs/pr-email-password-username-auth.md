# PR Notes: Email/Password + Username Auth

## Files Changed

- `apps/api/src/auth/*`: API-side Better Auth setup, username validation, and app profile upsert hook.
- `apps/api/src/routes/hono/authRoutes.ts` and `apps/api/src/honoApp.ts`: Hono-owned `/api/auth/*` route mounting.
- `apps/api/src/db/schema/auth.ts` and `apps/api/drizzle/0008_better_auth_username.sql`: Better Auth table schema and username columns/constraints.
- `apps/web/src/components/auth/auth-form.tsx`: email/password signup and email-or-username sign-in UI.
- `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth-client.ts`, and `apps/web/src/lib/username.ts`: matching web session config and username client support.
- `apps/web/src/app/api/auth/[...all]/route.ts`: same-origin proxy to the API-owned auth handler.
- `apps/web/src/lib/social-providers.ts` and `apps/web/src/lib/social-provider-types.ts`: removed social provider configuration.
- `apps/api/.dev.vars.example`, `apps/web/.env.example`, `apps/api/README.md`, `apps/web/README.md`, `context/*`, and `apps/api/docs/api-routing-audit.md`: updated auth ownership and configuration notes.

## DB Rows Wiped

Neon project `Fotocorp`, branch `Development` (`br-steep-sun-ao0nw2cc`) was inspected before deletion. FKs into `public."user"` were limited to `account`, `session`, and `app_user_profiles`.

Deleted in an ordered transaction:

| Table | Deleted rows |
| --- | ---: |
| `asset_fotobox_items` | 0 |
| `asset_download_logs` | 3 |
| `app_user_profiles` | 2 |
| `session` | 5 |
| `verification` | 0 |
| `account` | 3 |
| `user` | 2 |

No tables were dropped. No asset/catalog/media/import tables were wiped.

## Verification Query Result

```text
account: 0
app_user_profiles: 0
asset_download_logs: 0
asset_fotobox_items: 0
session: 0
user: 0
verification: 0
```

Username schema verification on Development:

```text
user.username: text, not null
user.displayUsername: text, nullable
user_username_unique_idx: present
user_username_format_check: present
user_username_lowercase_check: present
user_username_reserved_check: present
```

Protected catalog/media/import data remained present after the wipe.

## Mailer TODO

No production email sender abstraction exists yet. Better Auth password reset and email verification mail delivery are intentionally left as `TODO(auth-email)` in the auth config; no fake production email delivery is enabled.

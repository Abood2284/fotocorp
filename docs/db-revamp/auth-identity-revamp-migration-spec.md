# Auth & Identity Revamp — Migration Spec (Scoped)

**Status:** P0–**P4 applied** on Development (2026-06-01); P5+ not started  
**Date:** 2026-06-01  
**Environment baselined:** Neon Development `br-steep-sun-ao0nw2cc` (project `tiny-thunder-19900347`)  
**Audience:** Engineering before the “grand op” (schema + auth + contributor dedupe)

---

## 1. Executive summary

Fotocorp today runs **three unrelated login systems** (Better Auth customers, custom staff, custom contributor portal) across **15+ auth-related tables** with overlapping concepts and poor naming (`user`, `account`, `app_user_profiles`, `contributor_accounts`, etc.).

This spec defines a **scoped, phased** path to:

1. **Migrate only contributors who own catalog assets** (~96 people, ~729k `image_assets` links) into a clean identity model.
2. **Deduplicate** a small set of true duplicate contributor rows (same human, multiple legacy IDs).
3. **Replace** Better Auth + split profile tables with **`users`**, **`auth_credentials`**, **`auth_sessions`**, and **`auth_identity_claims`**.
4. **Wipe and recreate** test customers and staff (not sacred).
5. **Drop** legacy auth payloads (`legacy_payload`, old auth tables) after cutover — no long-term storage of historical auth blobs.

**Out of scope for v1:** Migrating 690 contributors with zero assets; full email-uniqueness backfill on legacy rows; production cutover (Development first).

### 1.1 All three personas — one platform

This revamp is **not contributor-only**. It unifies **users** (public subscribers), **staff** (internal dashboard), and **contributors** (upload portal) under the same auth primitives:

| Persona | Profile table | Credentials | Sacred data on Dev? |
| --- | --- | --- | --- |
| **Users** | `users` | `auth_credentials` (`owner_type = USER`) | **No** — wipe & recreate |
| **Staff** | `staff_members` | `auth_credentials` (`owner_type = STAFF`) | **No** — wipe & bootstrap |
| **Contributors** | `contributors` (slimmed) | `auth_credentials` (`owner_type = CONTRIBUTOR`) | **Yes** — asset owners only (~93 after dedupe) |

Shared for everyone: **`auth_sessions`**, **`auth_identity_claims`**, one login API, one cookie (`fotocorp_session`), one `/sign-in` entry (later phase).

**Why contributors go first in the sequence:** they carry **catalog FKs** (`image_assets`, uploads, events). Users and staff have almost no production data on Development (2 test users, 1 staff) and can be rebuilt once the shared auth tables exist.

---

## 2. Locked product decisions (from brainstorm)

| Decision | Choice |
| --- | --- |
| Sacred legacy data | **Contributors who own `image_assets` only** |
| Customers / staff data | **May be deleted and recreated** |
| Auth provider | **Drop Better Auth**; first-party session + scrypt credentials |
| Customer profile table name | **`users`** (single row per registrant) |
| Credential model | **`auth_credentials`** with `owner_type` + `owner_id` (option B) |
| Global uniqueness | **`auth_identity_claims`** for username / email / phone |
| Placeholder email `contact@fotocorp.com` | **Never merge** rows that only share this email |
| Legacy `contributors.legacy_payload` | **Drop after migration** |
| Central sign-in | **`/sign-in`** gateway (follow-up PR after schema) |
| Contributor applications | Footer **Apply to contributor** → inquiry row staff can approve (extend access-inquiries pattern) |
| Caption writers | **Reuse `/staff/*` dashboard** with role-based route allowlist (e.g. `CAPTION_MANAGER` / future `CAPTION_WRITER`) — no second admin app |

---

## 3. Current state (Development counts)

### 3.1 Contributor inventory

| Metric | Count |
| --- | ---: |
| Total `contributors` rows | 786 |
| Distinct `legacy_photographer_id` | 786 |
| Contributors with ≥1 `image_assets.contributor_id` | **96** |
| Total asset FKs to those contributors | **729,598** |
| Asset owners using `contact@fotocorp.com` | **28** (different display names) |
| Asset owners with no email | **8** |
| `contributor_accounts` (portal logins) | 50 (all `must_change_password`) |

### 3.2 Why email-only dedupe fails

- **764** rows have some email; **554** distinct normalized emails if merged blindly.
- **`contact@fotocorp.com`** appears on **32** rows total — among asset owners **28** are **different people** (Ganesh Lad, Stringer, Sunil Shirsekar, …).
- Merging on email would **destroy** catalog ownership.

### 3.3 Asset-owner duplicate groups (must merge)

Only **display-name duplicate groups among asset owners** (both own photos):

| Canonical winner (most assets) | Loser(s) | Assets to reassign |
| --- | --- | ---: |
| Ganesh Lad `83513349-…` (legacy **36**) | Ganesh L `5e8a0312-…` (legacy **2214**) | 4,459 → winner |
| Jafar Khan `9e9c4214-…` (legacy **642**) | Jafar Khan `308d36cb-…` (legacy **2218**) | 905 → winner |
| Subhash Barolia `1515a0fc-…` (legacy **773**) | SUBHASH BAROLIA `f4dc370d-…` (legacy **1072**) | 22 → winner |

**Expected canonical contributor count after merge:** **96 − 3 = 93** (pending manifest sign-off).

Among asset owners, **only 1** duplicate group shares a non-placeholder real email (2 rows) — email-based merge is almost unused for this cohort.

### 3.4 Auth tables today (to retire or replace)

| Table | Role |
| --- | --- |
| `user`, `account`, `session`, `verification` | Better Auth |
| `app_user_profiles` | App role / subscription flags |
| `fotocorp_user_profiles` | Registration / company fields |
| `staff_accounts`, `staff_sessions`, `staff_audit_logs` | Staff portal |
| `contributor_accounts`, `contributor_sessions` | Contributor portal |
| `auth_email_domain_*` (3 tables) | Business-email validation cache/overrides |

**Runtime FKs to `user.id` today:** `app_user_profiles`, `fotocorp_user_profiles`, `customer_access_inquiries`, `subscriber_entitlements`, plus fotobox/download logs using `auth_user_id` text.

**Runtime FKs to `contributors` / `contributor_accounts`:** `image_assets`, `photo_events`, `contributor_upload_*`, etc. — **must preserve** through contributor ID remap on merge.

---

## 4. Migration scope

### 4.1 In scope (v1)

- Neon **Development** branch.
- **93–96** canonical contributor profiles (post-dedupe).
- Remap `image_assets.contributor_id`, `photo_events.created_by_contributor_id`, upload batch FKs where needed.
- New auth schema + empty/wiped users & staff + bootstrap staff CLI.
- Contributor rows: normalized columns only; **no `legacy_payload`** in target.
- Generate **`contributor_migration_manifest.csv`** (see §6) before any destructive SQL.

### 4.2 Out of scope (v1)

- 690 contributors with **zero** assets (defer; optional later import from applications).
- Production branch cutover.
- Automatic merge of contributors that share placeholder email.
- Preserving Better Auth password hashes (users recreated).
- OAuth / social login.

### 4.3 Explicit non-goals

- Renaming `contributors` table (keeps FK stability).
- Merging `photographers` clean table in same PR (separate if still used for display).

---

## 5. Dedupe policy (plain language + rules)

### 5.1 Plain language

1. **Import rule:** If this person has photos in the archive, they get a row in the new system. If not, skip for now.
2. **Same person twice:** If two rows are the same human (e.g. “Ganesh L” and “Ganesh Lad”), **move all photos** to one row and delete the extra row.
3. **Same office email:** If many people share `contact@fotocorp.com`, they are **still different people** — **do not merge**.
4. **Login later:** Use **username** (unique) for portal login when email is placeholder or shared.

### 5.2 Machine rules (ordered)

```txt
INCLUDE row IF EXISTS (SELECT 1 FROM image_assets WHERE contributor_id = contributors.id)

MERGE loser INTO winner WHEN:
  (A) manual_merge_map says so, OR
  (B) same normalized display_name AND both in asset_owner_set AND winner = max(asset_count), OR
  (C) same normalized email AND email NOT IN placeholder_email_blocklist AND both in asset_owner_set

NEVER MERGE WHEN:
  - Only shared field is placeholder email
  - legacy_photographer_id differs AND display_name differs AND no manual map

WINNER SELECTION:
  1. Highest image_assets count
  2. Lower legacy_photographer_id (stable tie-break)
  3. Prefer longer display_name / full first+last name (manual override allowed)
```

### 5.3 Placeholder email blocklist

Treat as **non-unique contact info**, not identity:

- `contact@fotocorp.com`
- `contact@fotocorp.in` (if present)
- `info@fotocorp.com` (if present)

Store on `contributors.email` for display; **do not** insert into `auth_identity_claims` as `EMAIL` for more than one owner (prefer **no** email claim for placeholder-only rows; use username claim when credentials are issued).

---

## 6. Contributor migration manifest (required artifact)

Before destructive steps, generate a CSV committed under `docs/db-revamp/manifests/` (gitignored if sensitive — default OK on Development IDs only):

| Column | Description |
| --- | --- |
| `legacy_contributor_id` | UUID in current `contributors` |
| `legacy_photographer_id` | Numeric legacy id |
| `action` | `KEEP` \| `MERGE_INTO` \| `SKIP` |
| `canonical_contributor_id` | Winner UUID (new or same) |
| `display_name` | Final display name |
| `email` | Raw email (may be placeholder) |
| `email_is_placeholder` | boolean |
| `asset_count` | Pre-merge count |
| `merge_reason` | `MANUAL` \| `DISPLAY_NAME` \| `REAL_EMAIL` |

**SQL to regenerate asset-owner list:**

```sql
SELECT c.id, c.legacy_photographer_id, c.display_name, c.email,
       COUNT(ia.id) AS asset_count
FROM contributors c
JOIN image_assets ia ON ia.contributor_id = c.id
GROUP BY c.id, c.legacy_photographer_id, c.display_name, c.email
ORDER BY asset_count DESC;
```

**Pre-approved manual merges (Development):**

| Loser `legacy_photographer_id` | Winner `legacy_photographer_id` | Reason |
| ---: | ---: | --- |
| 2214 | 36 | Ganesh L → Ganesh Lad |
| 2218 | 642 | Duplicate Jafar Khan |
| 1072 | 773 | SUBHASH BAROLIA → Subhash Barolia |

---

## 7. Target schema (v1)

### 7.1 Table list

| Table | Purpose |
| --- | --- |
| **`users`** | Public registrants: identity + company + phone + subscription summary fields (replaces `app_user_profiles` + `fotocorp_user_profiles`) |
| **`contributors`** | Contributor profile (slimmed; asset owners only in v1) |
| **`staff_members`** | Internal staff profile (replaces `staff_accounts`) |
| **`auth_credentials`** | Login: `owner_type`, `owner_id`, `login_identifier`, `identifier_type`, `password_hash`, `status`, `must_reset_password` |
| **`auth_sessions`** | Session token hash, expiry, revoke |
| **`auth_identity_claims`** | Global unique username / email / phone reservations |
| **`access_inquiries`** | Extended: `inquiry_type` = `USER_ACCESS` \| `CONTRIBUTOR_APPLICATION`; staff review queue |

**Dropped after cutover:** `user`, `account`, `session`, `verification`, `app_user_profiles`, `fotocorp_user_profiles`, `staff_accounts`, `staff_sessions`, `contributor_accounts`, `contributor_sessions`, `contributors.legacy_payload` column.

### 7.2 `users` (illustrative columns)

| Column | Notes |
| --- | --- |
| `id` | `uuid` PK |
| `email` | Login + contact; unique via claims |
| `username` | Optional if email-only login |
| `first_name`, `last_name` | |
| `phone_country_code`, `phone_number` | E.164 normalized in claims |
| `company_type`, `company_name`, `job_title`, … | From current registration form |
| `status` | `ACTIVE` \| `SUSPENDED` |
| `is_subscriber`, `subscription_status`, quota fields | From `app_user_profiles` |
| `created_at`, `updated_at` | |

### 7.3 `contributors` (post-migration shape)

Keep existing UUIDs for **canonical** rows (winners). Drop columns:

- `legacy_payload` (jsonb) — **removed**
- `legacy_status` — **removed** (optional: keep `legacy_photographer_id` for audit until confident)

Retain: `display_name`, `first_name`, `last_name`, `email`, phones, address fields, `status`, `source` (`LEGACY_IMPORT` \| `MANUAL` \| `APPLICATION`).

### 7.4 `auth_credentials`

| Column | Notes |
| --- | --- |
| `owner_type` | `USER` \| `STAFF` \| `CONTRIBUTOR` |
| `owner_id` | FK to `users.id`, `staff_members.id`, or `contributors.id` |
| `login_identifier` | Username or email string used at sign-in |
| `identifier_type` | `USERNAME` \| `EMAIL` |
| `password_hash` | Single scrypt format (same as current staff/contributor) |

**Uniqueness:** `login_identifier` unique per `identifier_type` globally (or enforced via claims).

### 7.5 `auth_identity_claims`

| Column | Notes |
| --- | --- |
| `claim_type` | `USERNAME` \| `EMAIL` \| `PHONE` |
| `normalized_value` | lower(email), E.164 phone, lower(username) |
| `owner_type`, `owner_id` | |
| **UNIQUE** | `(claim_type, normalized_value)` |

**Registration / Apply to contributor:** insert claims in `PENDING` or active state per product rule; staff approval activates credential row.

### 7.6 Sessions (no Better Auth)

| Step | Owner |
| --- | --- |
| Login | API verifies `auth_credentials`, inserts `auth_sessions`, sets HttpOnly `fotocorp_session` |
| Me | Resolve session → `owner_type` → load profile |
| Logout | Revoke session row |

One cookie for all personas; route guards branch on `owner_type`.

---

## 8. Placeholder email strategy (28 asset owners)

| Concern | Approach |
| --- | --- |
| Catalog identity | **One contributor row per person** (display name + asset ownership) |
| Profile `email` column | May still show `contact@fotocorp.com` |
| Global email uniqueness | **Do not** register placeholder email in `auth_identity_claims` for all 28 |
| Portal login | Issue **unique username** per contributor when enabling access; optional real email later |
| Future Apply form | Collect real email; claim only if not placeholder and not taken |

This satisfies “we cannot leave any contributor who owns an asset” **without** falsely merging them.

---

## 9. FK remap checklist (merge script)

When `MERGE_INTO` executes, update in transaction:

1. `image_assets.contributor_id`
2. `photo_events.created_by_contributor_id`
3. `photo_events.created_by_contributor_account_id` (if still used — map via contributor credential migration)
4. `contributor_upload_batches.contributor_id` / `contributor_account_id`
5. `contributor_upload_items` (same)
6. Any admin audit rows referencing loser contributor id (if exist)

Then delete loser `contributors` row (and loser `contributor_accounts` if present).

**Validation gate:**

```sql
-- Zero assets pointing at non-canonical IDs
SELECT contributor_id, COUNT(*) FROM image_assets
WHERE contributor_id IS NOT NULL
  AND contributor_id NOT IN (SELECT id FROM contributors)
GROUP BY 1;
```

---

## 10. Better Auth removal process (reference)

Execute **after** new tables + login routes exist.

| Step | Action |
| --- | --- |
| 1 | Add `users`, `auth_credentials`, `auth_sessions`, `auth_identity_claims`; migrate FKs on `subscriber_entitlements`, `customer_access_inquiries`, fotobox, download logs to `users.id` |
| 2 | Implement Hono routes: `POST /api/v1/auth/login`, `logout`, `GET /me`, `POST /sign-up` (users only) |
| 3 | Web: remove `authClient`, Better Auth proxy, middleware cookie check → `fotocorp_session` |
| 4 | Truncate/delete BA tables + old profile tables on Development |
| 5 | Remove `better-auth` dependency from `apps/api` and `apps/web` |
| 6 | Update `context/architecture.md`, `api-routing-audit.md`, staff/contributor session docs |

**Session owner:** Fotocorp API (`apps/api`), same pattern as existing staff/contributor sessions.

---

## 11. Phased delivery (“grand op” sequence)

Recommended PR order — **do not combine** without explicit scope. Each phase should land **one primary concern**; all three personas are addressed by the end of P9.

### 11.1 Step-by-step master plan

| Step | Focus | Contributors | Users (subscribers) | Staff | Shared auth / UX |
| ---: | --- | --- | --- | --- | --- |
| **P0** | Plan & manifest | CSV manifest for 96 asset owners | — | — | Read-only SQL |
| **P1** | Catalog safety | Dedupe 3 merges; remap `image_assets` FKs | — | — | — |
| **P2** | New schema (parallel) | — | — | — | Add `users`, `staff_members`, `auth_credentials`, `auth_sessions`, `auth_identity_claims` **alongside** old tables |
| **P3** | Contributor profile | Slim table; ~93 rows; drop `legacy_payload` | — | — | Optional: contributor `auth_credentials` seed |
| **P4** | Users | — | Create `users`; migrate FKs (`subscriber_entitlements`, inquiries, fotobox, downloads); **truncate** Better Auth + old profile tables on Dev | — | User sign-up writes `users` + claims |
| **P5** | Unified auth | Contributor login via `auth_credentials` | User login/sign-up (replaces Better Auth) | — | One session table + `fotocorp_session`; Hono login/logout/me |
| **P6** | Staff | — | — | `staff_members`; bootstrap CLI; RBAC on `/staff/*` unchanged | Staff `auth_credentials`; retire `staff_accounts` / `staff_sessions` |
| **P7** | Registration queues | Apply-to-contributor → inquiries | User access inquiries (existing flow) | Staff review UI | Claims on submit; approve → create credential |
| **P8** | Single front door | — | Sign-in tab | Sign-in tab | `/sign-in` gateway; footer CTA; remove `/staff/login`, `/contributor/login` |
| **P9** | Cleanup | — | — | — | Drop `user`, `account`, `session`, `contributor_accounts`, etc. |

### 11.2 Phase detail table (PR sizing)

| Phase | PR / work unit | Deliverable | Risk |
| --- | --- | --- | --- |
| **P0** | Manifest only | `contributor_migration_manifest.csv` + SQL report scripts | Read-only |
| **P1** | Contributor dedupe | Merge 3 groups; remap FKs; verify asset counts | Medium — catalog |
| **P2** | Schema add | New tables alongside old; Drizzle migrations | Low |
| **P3** | Contributor cutover | Slim `contributors`; migrate 93–96 rows; drop `legacy_payload` | Medium |
| **P4** | Users + wipe BA | `users` + FK migration; truncate test users; new sign-up | Low on Dev |
| **P5** | Auth credentials | Unified login for **users + contributors**; one cookie; remove BA | High — touch all auth |
| **P6** | Staff recreate | `staff_members` + bootstrap; unified staff login | Low |
| **P7** | Claims + inquiries | Contributor application + extend staff UI | Medium |
| **P8** | Central `/sign-in` + footer CTA | All three personas via one URL | Low |
| **P9** | Drop old tables | Retire all legacy auth tables | High — irreversible |

**Decision point after P0:** Review manifest; confirm 93 canonical contributors and manual merges.

**Decision point after P5:** Users and contributors can log in on new stack; staff still on old tables until P6 (acceptable on Dev for a few days).

**Done definition:** All three personas authenticate through `auth_credentials` + `auth_sessions`; no Better Auth; no `contributor_accounts` / `staff_accounts`; claims enforce global username/email/phone.

---

## 12. Verification & rollback

### 12.1 Pre-flight (P0)

- [x] Manifest row count = 96 asset owners (`docs/db-revamp/manifests/contributor_migration_manifest.csv`)
- [x] Sum of `asset_count` in manifest = 729,598
- [x] Exactly 3 `MERGE_INTO` rows (MANUAL: legacy 2214→36, 2218→642, 1072→773)
- [x] Stakeholder sign-off on manifest before P1

### 12.2 Post P1 (dedupe)

- [x] Canonical contributor count = 93
- [x] No `image_assets` pointing to deleted UUIDs
- [x] Ganesh Lad total assets = 148,464
- [x] Jafar Khan total assets = 122,508
- [x] Subhash Barolia total assets = 937
- [x] P1 one-time apply completed on Development (script removed from repo)

### 12.2b Post P2 (schema)

- [x] Drizzle schema: `users`, `staff_members`, `auth_credentials`, `auth_sessions`, `auth_identity_claims`
- [x] Migration `0039_auth_identity_revamp_p2.sql` generated
- [x] `pnpm --dir apps/api db:migrate` applied on Development
- [x] Five new tables exist; row counts = 0 until P3–P6

Phase report removed post–Dev cutover; see `context/progress-tracker.md`.

### 12.2c Post P3 (contributor cutover)

- [x] `contributors.legacy_payload` and `legacy_status` dropped (`0040`)
- [x] `contributors.source` allows `APPLICATION`
- [x] 93 asset owners unchanged; P1 asset counts still valid
- [x] 93 `auth_credentials` (USERNAME) + 93 username claims; 0 placeholder email claims
- [x] P3 validated on Development (script removed from repo)

### 12.2d Post P4 (users)

- [x] `users` populated from `app_user_profiles` + `fotocorp_user_profiles` + `"user"`
- [x] FKs repointed: `subscriber_entitlements`, `customer_access_inquiries`, fotobox, download logs
- [x] Legacy auth/profile tables truncated on Development
- [x] `auth_credentials` + claims seeded for migrated users (where `account.password` existed)
- [x] P4 validated on Development (script removed from repo)

### 12.3 Post P5 (auth)

- [ ] User sign-up creates `users` + claims + credential
- [x] Staff bootstrap login → `staff_members` (P6 applied on Development)
- [ ] Contributor login via username (placeholder-email owners)
- [ ] Subscriber entitlements still resolve `users.id`

### 12.4 Rollback

- P1: Restore from Neon branch snapshot taken before merge (recommended: create branch `pre-auth-revamp-YYYYMMDD`).
- P5+: Keep BA tables until parallel login verified; dual-write not required if Dev downtime acceptable.

---

## 13. Open questions (decide before P2)

| # | Question | Options |
| --- | --- | --- |
| 1 | Keep `legacy_photographer_id` on `contributors` after revamp? | A) Yes, read-only audit / B) Drop after manifest archived |
| 2 | Issue portal credentials for all 93 asset owners in P3? | A) Yes, generated usernames / B) Only on staff approval |
| 3 | `access_inquiries` vs new `contributor_applications` table? | A) Extend inquiries with `inquiry_type` / B) Separate table, same staff UI |
| 4 | Email validation tables — keep for user sign-up? | A) Keep domain cache / B) Inline in service |
| 5 | Production cutover gate | Branch clone + rerun manifest on prod counts |

---

## 14. How to proceed (recommended next step)

1. **Review this spec** — confirm **all three personas**, contributor asset-owner scope, 3 merges, drop BA, `users` naming.
2. **Approve P0** — generate `contributor_migration_manifest.csv` (read-only).
3. **Neon branch** — snapshot Development (`pre-auth-revamp-YYYYMMDD`).
4. **P1 → P3** — contributors (catalog-safe) before touching user/staff login.
5. **P2 → P6** — shared schema, then users, then unified auth, then staff.
6. **P7 → P9** — inquiries, `/sign-in`, drop old tables.

No application code until P0 is signed off. Do not skip P1 before P3 (catalog integrity).

### 14.1 Suggested execution order (one line)

`P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9` — contributors first for data safety; users and staff in P4–P6; everyone on one auth stack by end of P6; UX polish P7–P8.

---

## 15. Related docs

| Doc | Link |
| --- | --- |
| DB revamp README | [README.md](./README.md) |
| Staff auth (current) | [staff-auth-runbook.md](./staff-auth-runbook.md) |
| Photographer/contributor auth (current) | [photographer-auth-runbook.md](./photographer-auth-runbook.md) |
| Schema duplication audit | [reports/schema-legacy-duplication-audit-report.md](./reports/schema-legacy-duplication-audit-report.md) |

---

## Appendix A — Top asset owners (Development)

| display_name | legacy_id | assets | email note |
| --- | ---: | ---: | --- |
| Ganesh Lad | 36 | 144,005 | placeholder |
| Jafar Khan | 642 | 121,603 | real |
| Sunil Shirsekar | 369 | 94,796 | placeholder |
| Sachin Kadvekar | 37 | 87,969 | placeholder |
| Stringer | 41 | 50,669 | placeholder |
| … | … | … | 91 more rows in manifest |

---

## Appendix B — Glossary

| Term | Meaning |
| --- | --- |
| Asset owner | `contributors.id` referenced by ≥1 `image_assets` row |
| Canonical contributor | Survivor row after dedupe; owns all merged assets |
| Placeholder email | Shared office inbox; not a person-level unique key |
| Claim | Reserved username/email/phone in `auth_identity_claims` |
| Grand op | Full sequence P0–P9 across schema + auth + UX |

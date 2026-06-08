# Resend + Google Workspace Email Integration

Fotocorp sends transactional access-flow email through Resend while keeping reply handling in Google Workspace.

## Sender and Replies

- Sender: `Fotocorp Subscriptions <subscription@fotocorp.com>`
- Reply-To: `subscription@fotocorp.com`
- Reply handling: Google Workspace receives replies for Shailesh through the existing `subscription@fotocorp.com` mailbox/routing.
- Sending provider: Resend.
- Resend receiving: intentionally disabled. Do not configure Resend inbound receiving for this flow.
- DNS/MX: no DNS, MX, or mailbox changes are required for this integration.

## Required API Worker Env

Set these in the API Worker environment. Store the API key as a Cloudflare secret.

```sh
RESEND_API_KEY=...
EMAIL_PROVIDER=resend
EMAIL_FROM_NAME=Fotocorp Subscriptions
EMAIL_FROM_ADDRESS=subscription@fotocorp.com
EMAIL_REPLY_TO=subscription@fotocorp.com
```

Optional:

```sh
PUBLIC_WEB_ORIGIN=https://fotocorp.com
```

When `PUBLIC_WEB_ORIGIN` is set, customer and contributor approval emails link to `/sign-in` on that origin. If it is not set, emails use `https://fotocorp.com/sign-in`.

## Templates

- `CUSTOMER_ACCESS_REQUEST_RECEIVED`: sent after customer registration/access inquiry creation.
- `CUSTOMER_ACCESS_APPROVED`: sent when staff activates one or more subscriber entitlements; includes download limits per asset type (separate email per individual activation; one consolidated email for bulk activate).
- `CUSTOMER_ENTITLEMENT_UPDATED`: sent when staff adjusts an active entitlement's download limit or quality cap.
- `CUSTOMER_ACCESS_REJECTED`: sent after staff closes a customer inquiry without granting access.
- `CONTRIBUTOR_APPLICATION_RECEIVED`: sent after contributor application creation when applicant email exists.
- `CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS`: sent after staff approves a contributor application. Includes contributor username, generated temporary password, and `/sign-in`.
- `CONTRIBUTOR_APPLICATION_REJECTED`: sent after staff closes a contributor application without granting access.
- `CUSTOMER_PASSWORD_RESET`: sent after a customer requests forgot-password on `/forgot-password`. Includes a one-time link to `/reset-password?token=…` (60-minute TTL). Idempotency keyed per `password_reset` token row.

Each template renders HTML and plain text, uses minimal inline styles, and includes:

```text
Fotocorp News Photo Agency
For questions, reply to this email.
```

## Delivery Logging

Delivery attempts are recorded in `email_delivery_logs`.

Statuses:

- `SENT`: provider accepted the email.
- `FAILED`: provider call failed or returned an error.
- `SKIPPED`: local/no-op provider was used or a prior successful delivery already exists.

A partial unique index prevents more than one successful delivery for the same `related_entity_type`, `related_entity_id`, and `template_key`. Resend requests also send a stable `Idempotency-Key` built from template key, related entity, and recipient.

Email logs intentionally do not store HTML or plain-text bodies. Contributor temporary passwords are sent to Resend in the outgoing email payload only and are not written to `email_delivery_logs`.

## Manual Test Steps

1. Confirm Worker env:

```sh
wrangler secret list
```

2. Start the API Worker with the configured environment:

```sh
pnpm --dir apps/api dev
```

3. Submit a customer registration through the web `/sign-in?tab=register` form, or call the web BFF sign-up route with a valid registration payload:

```sh
curl -i -X POST http://127.0.0.1:3000/api/auth/sign-up \
  -H 'Content-Type: application/json' \
  --data '{"email":"user@example.com","password":"replace-with-valid-password","name":"Test User","firstName":"Test","lastName":"User","username":"test.user","companyType":"MEDIA","companyName":"Example Media","jobTitle":"Editor","companyEmail":"user@example.com","phoneCountryCode":"+91","phoneNumber":"9999999999","interestedAssetTypes":["EDITORIAL"],"imageQuantityRange":"20_50","imageQualityPreference":"MEDIUM"}'
```

4. In the staff UI, open `/staff/access-inquiries/:inquiryId`, create/adjust draft entitlements, and activate one entitlement. This should send `CUSTOMER_ACCESS_APPROVED` with that asset type's limits. Activating a second asset type should send a separate approval email.

5. To test customer rejection, submit a separate inquiry and close it from `/staff/access-inquiries/:inquiryId`. This should send `CUSTOMER_ACCESS_REJECTED`.

6. Submit a contributor application through `/apply-contributor`. This should send `CONTRIBUTOR_APPLICATION_RECEIVED` when applicant email exists.

7. Approve the contributor application from `/staff/access-inquiries`. This should send `CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS` with the generated username/password and `/sign-in`.

8. Sign in through `/sign-in` with the received credentials (contributors are redirected to `/contributor/dashboard`) and change the temporary password when prompted/supported.

9. Close a separate contributor application. This should send `CONTRIBUTOR_APPLICATION_REJECTED`.

10. Verify delivery logs:

```sql
select recipient_email, template_key, provider, status, provider_message_id, error_message, created_at, sent_at
from email_delivery_logs
order by created_at desc
limit 20;
```

11. Re-run the same approval action where possible. The second successful template delivery for the same inquiry should be logged as `SKIPPED` with `duplicate_successful_delivery` and should not call Resend again.

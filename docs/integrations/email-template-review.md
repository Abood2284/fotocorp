# Fotocorp Transactional Email Template Review

This document is the client-review source for registration/access email wording. Runtime templates live in `apps/api/src/lib/email/templates.ts`.

All emails use:

- From: `Fotocorp Subscriptions <subscription@fotocorp.com>`
- Reply-To: `subscription@fotocorp.com`
- Footer:

```text
Fotocorp News Photo Agency
For questions, reply to this email.
```

## CUSTOMER_ACCESS_REQUEST_RECEIVED

Subject: `Your Fotocorp access request has been received`

```text
Hello {firstName},

Thank you for registering with Fotocorp. Your access request has been received and is now under review by our team.

We will notify you after staff approval has been completed.

Fotocorp News Photo Agency
For questions, reply to this email.
```

## STAFF_NEW_ACCESS_INQUIRY

Internal staff notification sent when a customer completes registration. Recipient is `STAFF_ACCESS_INQUIRY_NOTIFY_EMAIL` (env-configured).

Subject: `New Fotocorp access inquiry submitted`

```text
Hello Team,

A new user has submitted an access inquiry on Fotocorp.

Name: {inquiryApplicantName}
Company: {inquiryCompanyName}
Email: {inquiryApplicantEmail}

Review inquiry: {staffInquiryReviewUrl}

Fotocorp News Photo Agency
For questions, reply to this email.
```

## CUSTOMER_ACCESS_APPROVED

Subject (single asset): `Your Fotocorp {assetLabel} access has been approved`  
Subject (multiple assets in one send): `Your Fotocorp access has been approved`

HTML uses branded layout (navy header, warm card, entitlement limits table, amber sign-in CTA).

```text
Hello {firstName},

Your Fotocorp Images access has been approved.

Your download limits:
  • Images: 100 downloads · High quality

Sign in to start downloading: {customerSignInUrl}

Fotocorp News Photo Agency
For questions, reply to this email.
```

Bulk activation example:

```text
Hello {firstName},

Your Fotocorp access has been approved for the following asset types:

Your download limits:
  • Images: 100 downloads · High quality
  • Video: 50 downloads · Medium quality

Sign in to start downloading: {customerSignInUrl}
```

## CUSTOMER_ENTITLEMENT_UPDATED

Subject (single asset): `Your Fotocorp {assetLabel} access has been updated`

```text
Hello {firstName},

We updated your Fotocorp access for Images:

  • Download limit: 100 → 150
  • Quality cap: Medium → High

Sign in: {customerSignInUrl}

Fotocorp News Photo Agency
For questions, reply to this email.
```

## CUSTOMER_ACCESS_REJECTED

Subject: `Update on your Fotocorp access request`

```text
Hello {firstName},

Thank you for your interest in Fotocorp.

After reviewing your access request, we are unable to approve access at this time.

Fotocorp News Photo Agency
For questions, reply to this email.
```

## CONTRIBUTOR_APPLICATION_RECEIVED

Subject: `Your Fotocorp contributor application has been received`

```text
Hello {firstName},

Thank you for applying to contribute to Fotocorp. Your contributor application has been received and is now under review by our team.

We will notify you after staff review has been completed.

Fotocorp News Photo Agency
For questions, reply to this email.
```

## CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS

Subject: `Your Fotocorp contributor access has been approved`

```text
Hello {firstName},

Your Fotocorp contributor access has been approved.

Use the credentials below to sign in to the contributor portal:

Username: {username}

Temporary password: {temporaryPassword}

Contributor sign-in: {contributorSignInUrl}

After signing in, please change your temporary password.

Fotocorp News Photo Agency
For questions, reply to this email.
```

## CONTRIBUTOR_APPLICATION_REJECTED

Subject: `Update on your Fotocorp contributor application`

```text
Hello {firstName},

Thank you for your interest in contributing to Fotocorp.

After reviewing your contributor application, we are unable to approve access at this time.

Fotocorp News Photo Agency
For questions, reply to this email.
```

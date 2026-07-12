import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  deliverStaffInquiryEmail,
  deliverTemplatedEmail,
  formatRecipientLog,
  safeSendAccessInquiryEmail,
  STAFF_INQUIRY_NOTIFY_EMAILS,
} from "../src/lib/email/email-service"
import { createResendEmailProvider } from "../src/lib/email/resend-provider"
import { EMAIL_TEMPLATE_KEYS, type EmailProvider } from "../src/lib/email/types"
import { renderAccessEmailTemplate } from "../src/lib/email/templates"
import {
  buildStaffAccessInquiryEmailData,
  buildStaffContributorApplicationEmailData,
} from "../src/lib/email/staff-inquiry-email-data"

const env = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test_resend_key",
  EMAIL_FROM_NAME: "Fotocorp Subscriptions",
  EMAIL_FROM_ADDRESS: "subscription@fotocorp.com",
  EMAIL_REPLY_TO: "subscription@fotocorp.com",
}

describe("access email templates", () => {
  for (const templateKey of EMAIL_TEMPLATE_KEYS) {
    it(`renders ${templateKey} as HTML and text`, () => {
      const rendered = renderAccessEmailTemplate(templateKey, {
        recipient: {
          email: "reader@example.com",
          firstName: "<Ada>",
        },
        loginUrl: "https://fotocorp.com/sign-in",
      })

      assert.equal(rendered.templateKey, templateKey)
      assert.ok(rendered.subject.length > 0)
      assert.match(rendered.html, /Fotocorp News Photo Agency/)
      assert.match(rendered.text, /Fotocorp News Photo Agency/)
      assert.match(rendered.text, /For questions, reply to this email\./)
      assert.doesNotMatch(rendered.html, /<Ada>/)
      assert.match(rendered.html, /&lt;Ada&gt;/)
    })
  }

  it("renders CUSTOMER_PASSWORD_RESET with reset link CTA", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_PASSWORD_RESET", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        resetPasswordUrl: "https://fotocorp.com/reset-password?token=abc",
        resetLinkExpiresMinutes: 60,
      },
    })

    assert.equal(rendered.subject, "Reset your Fotocorp password")
    assert.match(rendered.text, /reset your Fotocorp password/i)
    assert.match(rendered.text, /within 60 minutes/)
    assert.match(rendered.text, /reset-password\?token=abc/)
    assert.match(rendered.html, /Reset password/)
  })

  it("renders STAFF_NEW_ACCESS_INQUIRY with full lead details and no review CTA", () => {
    const rendered = renderAccessEmailTemplate("STAFF_NEW_ACCESS_INQUIRY", {
      recipient: { email: "staff@example.com", firstName: "Team", displayName: "Fotocorp Staff" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        inquiryApplicantName: "Ada Lovelace",
        inquiryUsername: "ada.lovelace",
        inquiryCompanyName: "Analytical Engines Ltd",
        inquiryCompanyType: "Publisher",
        inquiryJobTitle: "Editor",
        inquiryApplicantEmail: "ada@example.com",
        inquiryPhone: "+91 9876543210",
        inquiryInterestLines: [
          { assetLabel: "Editorial", quantityRange: "50–100", qualityPreference: "High" },
          { assetLabel: "Video", quantityRange: "20–50" },
        ],
        inquirySubmittedAt: "2026-07-12T07:30:00.000Z",
        inquiryCountry: "IN",
        inquiryCity: "Mumbai",
        inquiryRegion: "Maharashtra",
        inquiryIpAddress: "203.0.113.10",
      },
    })

    assert.equal(rendered.subject, "You have a new customer access inquiry")
    assert.match(rendered.text, /Hello Team,/)
    assert.match(rendered.text, /You have a new customer access inquiry on Fotocorp\./)
    assert.match(rendered.text, /Name: Ada Lovelace/)
    assert.match(rendered.text, /Username: ada\.lovelace/)
    assert.match(rendered.text, /Company: Analytical Engines Ltd/)
    assert.match(rendered.text, /Company type: Publisher/)
    assert.match(rendered.text, /Job title: Editor/)
    assert.match(rendered.text, /Email: ada@example.com/)
    assert.match(rendered.text, /Phone: \+91 9876543210/)
    assert.match(rendered.text, /Editorial: quantity 50–100 · quality High/)
    assert.match(rendered.text, /Video: quantity 20–50/)
    assert.match(rendered.text, /Submitted at: 2026-07-12T07:30:00\.000Z/)
    assert.match(rendered.text, /Country: IN/)
    assert.match(rendered.text, /City: Mumbai/)
    assert.match(rendered.text, /Region: Maharashtra/)
    assert.match(rendered.text, /IP: 203\.0\.113\.10/)
    assert.doesNotMatch(rendered.text, /staff\/access-inquiries/)
    assert.doesNotMatch(rendered.html, /Review inquiry/)
    assert.doesNotMatch(rendered.html, /staff\/access-inquiries/)
  })

  it("renders STAFF_NEW_CONTRIBUTOR_APPLICATION with full lead details and no review CTA", () => {
    const rendered = renderAccessEmailTemplate("STAFF_NEW_CONTRIBUTOR_APPLICATION", {
      recipient: { email: "staff@example.com", firstName: "Team", displayName: "Fotocorp Staff" },
      data: {
        inquiryApplicantName: "Mira Shah",
        inquiryProposedUsername: "mira.news",
        inquiryApplicantEmail: "mira@example.com",
        inquiryPhone: "+91 9988776655",
        inquiryApplicationNotes: "Sports photographer covering IPL.",
        inquirySubmittedAt: "2026-07-12T08:00:00.000Z",
        inquiryCountry: "IN",
        inquiryCity: "Pune",
        inquiryRegion: "Maharashtra",
        inquiryIpAddress: "198.51.100.22",
      },
    })

    assert.equal(rendered.subject, "You have a new contributor application inquiry")
    assert.match(rendered.text, /You have a new contributor application inquiry on Fotocorp\./)
    assert.match(rendered.text, /Name: Mira Shah/)
    assert.match(rendered.text, /Proposed username: mira\.news/)
    assert.match(rendered.text, /Email: mira@example.com/)
    assert.match(rendered.text, /Phone: \+91 9988776655/)
    assert.match(rendered.text, /Application notes: Sports photographer covering IPL\./)
    assert.match(rendered.text, /Submitted at: 2026-07-12T08:00:00\.000Z/)
    assert.match(rendered.text, /Country: IN/)
    assert.match(rendered.text, /City: Pune/)
    assert.match(rendered.text, /Region: Maharashtra/)
    assert.match(rendered.text, /IP: 198\.51\.100\.22/)
    assert.doesNotMatch(rendered.text, /staff\/access-inquiries/)
    assert.doesNotMatch(rendered.html, /Review inquiry/)
  })

  it("renders CUSTOMER_ACCESS_APPROVED with entitlement limits and branded layout", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_ACCESS_APPROVED", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        entitlements: [
          {
            assetType: "EDITORIAL",
            assetLabel: "Editorial",
            allowedDownloads: 100,
            qualityAccess: "HIGH",
            qualityLabel: "High",
          },
          {
            assetType: "VIDEO",
            assetLabel: "Video",
            allowedDownloads: 50,
            qualityAccess: "MEDIUM",
            qualityLabel: "Medium",
          },
        ],
      },
    })

    assert.equal(rendered.subject, "Your Fotocorp access has been approved")
    assert.match(rendered.text, /Editorial: 100 downloads · High quality/)
    assert.match(rendered.text, /Video: 50 downloads · Medium quality/)
    assert.match(rendered.html, /Your download limits/)
    assert.match(rendered.html, /Sign in to Fotocorp/)
    assert.match(rendered.html, /#1a2540/)
    assert.match(rendered.html, /#c07c0a/)
  })

  it("uses asset-specific subject for single entitlement approval", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_ACCESS_APPROVED", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        entitlements: [
          {
            assetType: "EDITORIAL",
            assetLabel: "Editorial",
            allowedDownloads: 100,
            qualityAccess: "HIGH",
            qualityLabel: "High",
          },
        ],
      },
    })

    assert.equal(rendered.subject, "Your Fotocorp Editorial access has been approved")
    assert.match(rendered.text, /Your Fotocorp Editorial access has been approved/)
  })

  it("renders CUSTOMER_ENTITLEMENT_UPDATED with before and after values", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_ENTITLEMENT_UPDATED", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        entitlementChanges: [
          {
            assetLabel: "Editorial",
            fieldLabel: "Download limit",
            previousValue: "100",
            newValue: "150",
          },
          {
            assetLabel: "Editorial",
            fieldLabel: "Quality cap",
            previousValue: "Medium",
            newValue: "High",
          },
        ],
      },
    })

    assert.equal(rendered.subject, "Your Fotocorp Editorial access has been updated")
    assert.match(rendered.text, /Download limit: 100 → 150/)
    assert.match(rendered.text, /Quality cap: Medium → High/)
    assert.match(rendered.html, /150/)
    assert.match(rendered.html, /line-through/)
  })
})

describe("Resend provider", () => {
  it("posts the expected request shape", async () => {
    let captured: { url: string; init: RequestInit } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      captured = { url: String(url), init: init ?? {} }
      return new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const provider = createResendEmailProvider({ apiKey: "secret_key", fetchImpl })
    const result = await provider.send({
      templateKey: "CUSTOMER_ACCESS_APPROVED",
      displayName: "Customer Access Approved",
      from: "Fotocorp Subscriptions <subscription@fotocorp.com>",
      to: "reader@example.com",
      subject: "Your Fotocorp access has been approved",
      html: "<p>Approved</p>",
      text: "Approved",
      replyTo: "subscription@fotocorp.com",
      idempotencyKey: "CUSTOMER_ACCESS_APPROVED:customer_access_inquiry:abc:reader@example.com",
    })

    assert.equal(result.status, "SENT")
    assert.equal(result.providerMessageId, "email_123")
    assert.equal(captured?.url, "https://api.resend.com/emails")
    assert.equal(captured?.init.method, "POST")
    assert.equal((captured?.init.headers as Record<string, string>).Authorization, "Bearer secret_key")
    assert.equal(
      (captured?.init.headers as Record<string, string>)["Idempotency-Key"],
      "CUSTOMER_ACCESS_APPROVED:customer_access_inquiry:abc:reader@example.com",
    )
    assert.deepEqual(JSON.parse(String(captured?.init.body)), {
      from: "Fotocorp Subscriptions <subscription@fotocorp.com>",
      to: "reader@example.com",
      subject: "Your Fotocorp access has been approved",
      html: "<p>Approved</p>",
      text: "Approved",
      reply_to: "subscription@fotocorp.com",
    })
  })

  it("posts staff inquiry email with all recipients in To", async () => {
    let capturedBody: Record<string, unknown> | null = null
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ id: "email_staff_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const provider = createResendEmailProvider({ apiKey: "secret_key", fetchImpl })
    const result = await provider.send({
      templateKey: "STAFF_NEW_ACCESS_INQUIRY",
      displayName: "Staff New Access Inquiry",
      from: "Fotocorp Subscriptions <subscription@fotocorp.com>",
      to: [...STAFF_INQUIRY_NOTIFY_EMAILS],
      subject: "You have a new customer access inquiry",
      html: "<p>Lead</p>",
      text: "Lead",
      replyTo: "subscription@fotocorp.com",
      idempotencyKey: "STAFF_NEW_ACCESS_INQUIRY:customer_access_inquiry:abc:staff-notify",
    })

    assert.equal(result.status, "SENT")
    assert.deepEqual(capturedBody?.to, [...STAFF_INQUIRY_NOTIFY_EMAILS])
    assert.equal(capturedBody?.reply_to, "subscription@fotocorp.com")
  })
})

describe("email delivery safety", () => {
  it("renders contributor approval credentials in the outgoing provider payload", async () => {
    const db = fakeDb([])
    let html = ""
    let text = ""
    const provider: EmailProvider = {
      name: "test",
      async send(email) {
        html = email.html
        text = email.text
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: "message-1",
          errorMessage: null,
        }
      },
    }

    const result = await deliverTemplatedEmail(db as never, env, {
      templateKey: "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS",
      recipient: { email: "contributor@example.com", firstName: "Mira" },
      relatedEntity: { type: "customer_access_inquiry", id: "contrib-inquiry-1" },
      data: {
        contributorUsername: "mira.news",
        temporaryPassword: "TempPass-123",
        contributorLoginUrl: "https://fotocorp.com/sign-in",
      },
    }, { provider })

    assert.equal(result.status, "SENT")
    assert.match(text, /mira\.news/)
    assert.match(text, /TempPass-123/)
    assert.match(text, /https:\/\/fotocorp\.com\/sign-in/)
    assert.match(html, /mira\.news/)
    assert.match(html, /TempPass-123/)
  })

  it("does not store contributor temporary password or full body in delivery logs", async () => {
    const db = fakeDb([])
    const provider: EmailProvider = {
      name: "test",
      async send() {
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: "message-2",
          errorMessage: null,
        }
      },
    }

    await deliverTemplatedEmail(db as never, env, {
      templateKey: "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS",
      recipient: { email: "contributor@example.com", firstName: "Mira" },
      relatedEntity: { type: "customer_access_inquiry", id: "contrib-inquiry-2" },
      data: {
        contributorUsername: "mira.news",
        temporaryPassword: "TempPass-123",
        contributorLoginUrl: "https://fotocorp.com/sign-in",
      },
    }, { provider })

    const loggedSqlPayload = db.executedPayloads.join("\n")
    assert.doesNotMatch(loggedSqlPayload, /TempPass-123/)
    assert.doesNotMatch(loggedSqlPayload, /Use the credentials below/)
  })

  it("keeps staff notes out of rejection templates", () => {
    const rendered = renderAccessEmailTemplate("CONTRIBUTOR_APPLICATION_REJECTED", {
      recipient: { email: "contributor@example.com", firstName: "Mira" },
    })

    assert.doesNotMatch(rendered.text, /internal fraud review/i)
    assert.doesNotMatch(rendered.html, /internal fraud review/i)
    assert.match(rendered.text, /unable to approve access at this time/i)
  })

  it("does not throw when provider delivery fails for access flow templates", async () => {
    const db = fakeDb([])
    const provider: EmailProvider = {
      name: "test",
      async send() {
        throw new Error("provider unavailable")
      },
    }

    for (const templateKey of EMAIL_TEMPLATE_KEYS) {
      const result = await safeSendAccessInquiryEmail(db as never, env, {
        templateKey,
        recipient: { email: "reader@example.com", firstName: "Ada" },
        relatedEntity: { type: "customer_access_inquiry", id: `inquiry-${templateKey}` },
      }, { provider })

      assert.equal(result.status, "FAILED")
      assert.match(result.errorMessage ?? "", /provider unavailable/)
    }
  })

  it("prevents duplicate successful sends for the same request and template", async () => {
    const db = fakeDb([[{ id: "existing-log" }]])
    let sends = 0
    const provider: EmailProvider = {
      name: "test",
      async send() {
        sends += 1
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: "new-message",
          errorMessage: null,
        }
      },
    }

    const result = await deliverTemplatedEmail(db as never, env, {
      templateKey: "CUSTOMER_ACCESS_APPROVED",
      recipient: { email: "reader@example.com", firstName: "Ada" },
      relatedEntity: { type: "customer_access_inquiry", id: "inquiry-1" },
    }, { provider })

    assert.equal(result.status, "SKIPPED")
    assert.equal(result.errorMessage, "duplicate_successful_delivery")
    assert.equal(sends, 0)
    assert.equal(db.executedCount, 2)
  })

  it("allows separate approval emails per entitlement for the same inquiry", async () => {
    const db = fakeDb([[], []])
    let sends = 0
    const provider: EmailProvider = {
      name: "test",
      async send() {
        sends += 1
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: `message-${sends}`,
          errorMessage: null,
        }
      },
    }

    const baseInput = {
      templateKey: "CUSTOMER_ACCESS_APPROVED" as const,
      recipient: { email: "reader@example.com", firstName: "Ada" },
      data: {
        entitlements: [
          {
            assetType: "EDITORIAL" as const,
            assetLabel: "Editorial",
            allowedDownloads: 100,
            qualityAccess: "HIGH" as const,
            qualityLabel: "High",
          },
        ],
      },
    }

    const imageResult = await deliverTemplatedEmail(db as never, env, {
      ...baseInput,
      relatedEntity: { type: "subscriber_entitlement", id: "entitlement-image" },
    }, { provider })
    const videoResult = await deliverTemplatedEmail(db as never, env, {
      ...baseInput,
      relatedEntity: { type: "subscriber_entitlement", id: "entitlement-video" },
      data: {
        entitlements: [
          {
            assetType: "VIDEO" as const,
            assetLabel: "Video",
            allowedDownloads: 20,
            qualityAccess: "MEDIUM" as const,
            qualityLabel: "Medium",
          },
        ],
      },
    }, { provider })

    assert.equal(imageResult.status, "SENT")
    assert.equal(videoResult.status, "SENT")
    assert.equal(sends, 2)
  })

  it("sends staff inquiry mail once to all hardcoded recipients", async () => {
    const db = fakeDb([[], []])
    let capturedTo: string | string[] | null = null
    let capturedIdempotencyKey: string | null | undefined = null
    const provider: EmailProvider = {
      name: "test",
      async send(email) {
        capturedTo = email.to
        capturedIdempotencyKey = email.idempotencyKey
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: "staff-message-1",
          errorMessage: null,
        }
      },
    }

    const result = await deliverStaffInquiryEmail(db as never, env, {
      templateKey: "STAFF_NEW_ACCESS_INQUIRY",
      relatedEntity: { type: "customer_access_inquiry", id: "inquiry-staff-1" },
      data: {
        inquiryApplicantName: "Ada Lovelace",
        inquiryApplicantEmail: "ada@example.com",
      },
    }, { provider })

    assert.equal(result.status, "SENT")
    assert.deepEqual(capturedTo, [...STAFF_INQUIRY_NOTIFY_EMAILS])
    assert.equal(
      capturedIdempotencyKey,
      "STAFF_NEW_ACCESS_INQUIRY:customer_access_inquiry:inquiry-staff-1:staff-notify",
    )
    assert.match(db.executedPayloads.join("\n"), new RegExp(formatRecipientLog(STAFF_INQUIRY_NOTIFY_EMAILS)))
  })

  it("skips duplicate staff inquiry sends for the same inquiry and template", async () => {
    const db = fakeDb([[{ id: "existing-log" }]])
    let sends = 0
    const provider: EmailProvider = {
      name: "test",
      async send() {
        sends += 1
        return {
          status: "SENT",
          provider: "test",
          providerMessageId: "new-message",
          errorMessage: null,
        }
      },
    }

    const result = await deliverStaffInquiryEmail(db as never, env, {
      templateKey: "STAFF_NEW_CONTRIBUTOR_APPLICATION",
      relatedEntity: { type: "customer_access_inquiry", id: "inquiry-staff-2" },
    }, { provider })

    assert.equal(result.status, "SKIPPED")
    assert.equal(result.errorMessage, "duplicate_successful_delivery")
    assert.equal(sends, 0)
  })

  it("maps registration profile and audit into staff access inquiry email data", () => {
    const data = buildStaffAccessInquiryEmailData({
      profile: {
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada.lovelace",
        companyType: "publisher",
        companyName: "Analytical Engines Ltd",
        jobTitle: "Other",
        customJobTitle: "Chief Analyst",
        companyEmail: "ada@example.com",
        companyEmailDomain: "example.com",
        emailValidationDecision: "ALLOW",
        phoneCountryCode: "91",
        phoneNumber: "9876543210",
        interestedAssetTypes: ["EDITORIAL", "VIDEO"],
        imageQuantityRange: "50_100",
        imageQualityPreference: "HIGH",
        royaltyFreeQuantityRange: null,
        royaltyFreeQualityPreference: null,
        videoQuantityRange: "20_50",
        caricatureQuantityRange: null,
      },
      requestAudit: {
        ipAddress: "203.0.113.10",
        ipHash: "hash",
        country: "IN",
        city: "Mumbai",
        region: "Maharashtra",
        regionCode: "MH",
        cfRay: null,
        userAgent: null,
      },
      submittedAt: new Date("2026-07-12T07:30:00.000Z"),
    })

    assert.equal(data.inquiryApplicantName, "Ada Lovelace")
    assert.equal(data.inquiryUsername, "ada.lovelace")
    assert.equal(data.inquiryCompanyType, "Publisher")
    assert.equal(data.inquiryJobTitle, "Other (Chief Analyst)")
    assert.equal(data.inquiryPhone, "+91 9876543210")
    assert.deepEqual(data.inquiryInterestLines, [
      { assetLabel: "Editorial", quantityRange: "50–100", qualityPreference: "High" },
      { assetLabel: "Video", quantityRange: "20–50" },
    ])
    assert.equal(data.inquirySubmittedAt, "2026-07-12T07:30:00.000Z")
    assert.equal(data.inquiryCountry, "IN")
    assert.equal(data.inquiryCity, "Mumbai")
    assert.equal(data.inquiryRegion, "Maharashtra")
    assert.equal(data.inquiryIpAddress, "203.0.113.10")
  })

  it("maps contributor application fields into staff email data", () => {
    const data = buildStaffContributorApplicationEmailData({
      firstName: "Mira",
      lastName: "Shah",
      proposedUsername: "mira.news",
      email: "mira@example.com",
      phoneCountryCode: "91",
      phoneNumber: "9988776655",
      applicationNotes: "Sports photographer",
      requestAudit: {
        ipAddress: "198.51.100.22",
        ipHash: "hash",
        country: "IN",
        city: "Pune",
        region: "Maharashtra",
        regionCode: "MH",
        cfRay: null,
        userAgent: null,
      },
      submittedAt: "2026-07-12T08:00:00.000Z",
    })

    assert.equal(data.inquiryApplicantName, "Mira Shah")
    assert.equal(data.inquiryProposedUsername, "mira.news")
    assert.equal(data.inquiryApplicantEmail, "mira@example.com")
    assert.equal(data.inquiryPhone, "+91 9988776655")
    assert.equal(data.inquiryApplicationNotes, "Sports photographer")
    assert.equal(data.inquiryIpAddress, "198.51.100.22")
  })
})

function fakeDb(selectResults: unknown[][]) {
  let executeCount = 0
  const executedPayloads: string[] = []
  return {
    get executedCount() {
      return executeCount
    },
    get executedPayloads() {
      return executedPayloads
    },
    async execute(query: unknown) {
      const result = selectResults.shift() ?? []
      executeCount += 1
      executedPayloads.push(JSON.stringify(query))
      return result
    },
  }
}

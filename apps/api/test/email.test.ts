import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { deliverTemplatedEmail, safeSendAccessInquiryEmail } from "../src/lib/email/email-service"
import { createResendEmailProvider } from "../src/lib/email/resend-provider"
import { EMAIL_TEMPLATE_KEYS, type EmailProvider } from "../src/lib/email/types"
import { renderAccessEmailTemplate } from "../src/lib/email/templates"

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

  it("renders CUSTOMER_ACCESS_APPROVED with entitlement limits and branded layout", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_ACCESS_APPROVED", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        entitlements: [
          {
            assetType: "IMAGE",
            assetLabel: "Images",
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
    assert.match(rendered.text, /Images: 100 downloads · High quality/)
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
            assetType: "IMAGE",
            assetLabel: "Images",
            allowedDownloads: 100,
            qualityAccess: "HIGH",
            qualityLabel: "High",
          },
        ],
      },
    })

    assert.equal(rendered.subject, "Your Fotocorp Images access has been approved")
    assert.match(rendered.text, /Your Fotocorp Images access has been approved/)
  })

  it("renders CUSTOMER_ENTITLEMENT_UPDATED with before and after values", () => {
    const rendered = renderAccessEmailTemplate("CUSTOMER_ENTITLEMENT_UPDATED", {
      recipient: { email: "reader@example.com", firstName: "Ada" },
      loginUrl: "https://fotocorp.com/sign-in",
      data: {
        entitlementChanges: [
          {
            assetLabel: "Images",
            fieldLabel: "Download limit",
            previousValue: "100",
            newValue: "150",
          },
          {
            assetLabel: "Images",
            fieldLabel: "Quality cap",
            previousValue: "Medium",
            newValue: "High",
          },
        ],
      },
    })

    assert.equal(rendered.subject, "Your Fotocorp Images access has been updated")
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
        contributorLoginUrl: "https://fotocorp.com/sign-in?persona=contributor",
      },
    }, { provider })

    assert.equal(result.status, "SENT")
    assert.match(text, /mira\.news/)
    assert.match(text, /TempPass-123/)
    assert.match(text, /https:\/\/fotocorp\.com\/sign-in\?persona=contributor/)
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
        contributorLoginUrl: "https://fotocorp.com/sign-in?persona=contributor",
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
            assetType: "IMAGE" as const,
            assetLabel: "Images",
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

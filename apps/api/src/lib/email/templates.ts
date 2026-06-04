import type {
  EmailRecipient,
  EmailTemplateData,
  EmailTemplateKey,
  EntitlementChangeLine,
  EntitlementEmailLine,
  RenderedEmail,
} from "./types"

const FOOTER_LINES = ["Fotocorp News Photo Agency", "For questions, reply to this email."]

export interface AccessEmailTemplateInput {
  recipient: EmailRecipient
  loginUrl?: string | null
  data?: EmailTemplateData
}

export const EMAIL_TEMPLATE_METADATA: Record<EmailTemplateKey, { displayName: string; subject: string }> = {
  CUSTOMER_ACCESS_REQUEST_RECEIVED: {
    displayName: "Customer Access Request Received",
    subject: "Your Fotocorp access request has been received",
  },
  CUSTOMER_ACCESS_APPROVED: {
    displayName: "Customer Access Approved",
    subject: "Your Fotocorp access has been approved",
  },
  CUSTOMER_ENTITLEMENT_UPDATED: {
    displayName: "Customer Entitlement Updated",
    subject: "Your Fotocorp access has been updated",
  },
  CUSTOMER_ACCESS_REJECTED: {
    displayName: "Customer Access Rejected",
    subject: "Update on your Fotocorp access request",
  },
  CONTRIBUTOR_APPLICATION_RECEIVED: {
    displayName: "Contributor Application Received",
    subject: "Your Fotocorp contributor application has been received",
  },
  CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS: {
    displayName: "Contributor Application Approved With Credentials",
    subject: "Your Fotocorp contributor access has been approved",
  },
  CONTRIBUTOR_APPLICATION_REJECTED: {
    displayName: "Contributor Application Rejected",
    subject: "Update on your Fotocorp contributor application",
  },
  CUSTOMER_PASSWORD_RESET: {
    displayName: "Customer Password Reset",
    subject: "Reset your Fotocorp password",
  },
}

export function renderAccessEmailTemplate(
  templateKey: EmailTemplateKey,
  input: AccessEmailTemplateInput,
): RenderedEmail {
  const metadata = EMAIL_TEMPLATE_METADATA[templateKey]
  const greetingName = formatGreetingName(input.recipient)
  const loginUrl = input.loginUrl?.trim() || "https://fotocorp.com"
  const data = input.data ?? {}

  const subject = resolveSubject(templateKey, data, metadata.subject)
  const body = bodyLines(templateKey, greetingName, loginUrl, data)
  const text = [...body.textLines, "", ...FOOTER_LINES].join("\n")

  return {
    templateKey,
    displayName: metadata.displayName,
    subject,
    html: renderBrandedHtml(subject, body),
    text,
  }
}

interface BodyContent {
  introLines: string[]
  textLines: string[]
  entitlementLines?: EntitlementEmailLine[]
  changeLines?: EntitlementChangeLine[]
  ctaLabel?: string
  ctaUrl?: string
  credentialLines?: string[]
}

function resolveSubject(templateKey: EmailTemplateKey, data: EmailTemplateData, defaultSubject: string): string {
  if (templateKey === "CUSTOMER_ACCESS_APPROVED") {
    const entitlements = data.entitlements ?? []
    if (entitlements.length === 1) {
      return `Your Fotocorp ${entitlements[0]!.assetLabel} access has been approved`
    }
    if (entitlements.length > 1) {
      return "Your Fotocorp access has been approved"
    }
  }

  if (templateKey === "CUSTOMER_ENTITLEMENT_UPDATED") {
    const changes = data.entitlementChanges ?? []
    const assetLabels = [...new Set(changes.map((c) => c.assetLabel))]
    if (assetLabels.length === 1) {
      return `Your Fotocorp ${assetLabels[0]} access has been updated`
    }
  }

  return defaultSubject
}

function bodyLines(
  templateKey: EmailTemplateKey,
  greetingName: string,
  loginUrl: string,
  data: EmailTemplateData,
): BodyContent {
  if (templateKey === "CUSTOMER_ACCESS_REQUEST_RECEIVED") {
    return {
      introLines: [
        `Hello ${greetingName},`,
        "Thank you for registering with Fotocorp. Your access request has been received and is now under review by our team.",
        "We will notify you after staff approval has been completed.",
      ],
      textLines: [
        `Hello ${greetingName},`,
        "Thank you for registering with Fotocorp. Your access request has been received and is now under review by our team.",
        "We will notify you after staff approval has been completed.",
      ],
    }
  }

  if (templateKey === "CUSTOMER_ACCESS_APPROVED") {
    const entitlements = data.entitlements ?? []
    const single = entitlements.length === 1
    const intro = single
      ? [`Hello ${greetingName},`, `Your Fotocorp ${entitlements[0]!.assetLabel} access has been approved.`]
      : [
          `Hello ${greetingName},`,
          entitlements.length > 1
            ? "Your Fotocorp access has been approved for the following asset types:"
            : "Your Fotocorp access has been approved.",
        ]

    const textLines = [
      ...intro,
      ...(entitlements.length
        ? ["", "Your download limits:", ...entitlements.map(formatEntitlementTextLine)]
        : ["You can now sign in and use your approved access."]),
      "",
      `Sign in to start downloading: ${loginUrl}`,
    ]

    return {
      introLines: intro,
      textLines,
      entitlementLines: entitlements.length ? entitlements : undefined,
      ctaLabel: "Sign in to Fotocorp",
      ctaUrl: loginUrl,
    }
  }

  if (templateKey === "CUSTOMER_ENTITLEMENT_UPDATED") {
    const changes = data.entitlementChanges ?? []
    const assetLabels = [...new Set(changes.map((c) => c.assetLabel))]
    const intro =
      assetLabels.length === 1
        ? [`Hello ${greetingName},`, `We updated your Fotocorp access for ${assetLabels[0]}:`]
        : [`Hello ${greetingName},`, "We updated your Fotocorp access:"]

    const textLines = [
      ...intro,
      "",
      ...changes.map((c) => `  • ${c.fieldLabel}: ${c.previousValue} → ${c.newValue}`),
      "",
      `Sign in: ${loginUrl}`,
    ]

    return {
      introLines: intro,
      textLines,
      changeLines: changes,
      ctaLabel: "Sign in to Fotocorp",
      ctaUrl: loginUrl,
    }
  }

  if (templateKey === "CUSTOMER_ACCESS_REJECTED") {
    return {
      introLines: [
        `Hello ${greetingName},`,
        "Thank you for your interest in Fotocorp.",
        "After reviewing your access request, we are unable to approve access at this time.",
      ],
      textLines: [
        `Hello ${greetingName},`,
        "Thank you for your interest in Fotocorp.",
        "After reviewing your access request, we are unable to approve access at this time.",
      ],
    }
  }

  if (templateKey === "CUSTOMER_PASSWORD_RESET") {
    const resetUrl = data.resetPasswordUrl?.trim() || loginUrl
    const expiresMinutes = data.resetLinkExpiresMinutes ?? 60
    const intro = [
      `Hello ${greetingName},`,
      "We received a request to reset your Fotocorp password.",
      `Use the link below within ${expiresMinutes} minutes. If you did not request this, you can ignore this email.`,
    ]
    const textLines = [
      ...intro,
      "",
      `Reset your password: ${resetUrl}`,
    ]
    return {
      introLines: intro,
      textLines,
      ctaLabel: "Reset password",
      ctaUrl: resetUrl,
    }
  }

  if (templateKey === "CONTRIBUTOR_APPLICATION_RECEIVED") {
    return {
      introLines: [
        `Hello ${greetingName},`,
        "Thank you for applying to contribute to Fotocorp. Your contributor application has been received and is now under review by our team.",
        "We will notify you after staff review has been completed.",
      ],
      textLines: [
        `Hello ${greetingName},`,
        "Thank you for applying to contribute to Fotocorp. Your contributor application has been received and is now under review by our team.",
        "We will notify you after staff review has been completed.",
      ],
    }
  }

  if (templateKey === "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS") {
    const username = data.contributorUsername?.trim() || "Not available"
    const temporaryPassword = data.temporaryPassword?.trim() || "Not available"
    const contributorUrl = data.contributorLoginUrl?.trim() || loginUrl
    const credentialLines = [
      `Username: ${username}`,
      `Temporary password: ${temporaryPassword}`,
    ]
    const textLines = [
      `Hello ${greetingName},`,
      "Your Fotocorp contributor access has been approved.",
      "Use the credentials below to sign in to the contributor portal:",
      ...credentialLines,
      `Contributor sign-in: ${contributorUrl}`,
    ]
    if (data.passwordChangeSupported !== false) {
      textLines.push("After signing in, please change your temporary password.")
    }

    return {
      introLines: [
        `Hello ${greetingName},`,
        "Your Fotocorp contributor access has been approved.",
        "Use the credentials below to sign in to the contributor portal:",
      ],
      textLines,
      credentialLines,
      ctaLabel: "Sign in to contributor portal",
      ctaUrl: contributorUrl,
    }
  }

  return {
    introLines: [
      `Hello ${greetingName},`,
      "Thank you for your interest in contributing to Fotocorp.",
      "After reviewing your contributor application, we are unable to approve access at this time.",
    ],
    textLines: [
      `Hello ${greetingName},`,
      "Thank you for your interest in contributing to Fotocorp.",
      "After reviewing your contributor application, we are unable to approve access at this time.",
    ],
  }
}

function formatEntitlementTextLine(line: EntitlementEmailLine): string {
  return `  • ${line.assetLabel}: ${line.allowedDownloads} downloads · ${line.qualityLabel} quality`
}

function formatGreetingName(recipient: EmailRecipient): string {
  const raw = recipient.firstName?.trim() || recipient.displayName?.trim() || ""
  return raw || "there"
}

function renderBrandedHtml(subject: string, body: BodyContent): string {
  const introHtml = body.introLines.map((line) => renderParagraph(line)).join("")
  const entitlementHtml = body.entitlementLines?.length ? renderEntitlementTable(body.entitlementLines) : ""
  const changesHtml = body.changeLines?.length ? renderChangesTable(body.changeLines) : ""
  const credentialsHtml = body.credentialLines?.length ? renderCredentialsBlock(body.credentialLines) : ""
  const ctaHtml = body.ctaUrl ? renderCtaButton(body.ctaLabel ?? "Continue", body.ctaUrl) : ""

  return [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#faf8f5;color:#0d0f1a;font-family:Georgia,\'Times New Roman\',serif;line-height:1.6;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5dfd3;border-radius:8px;overflow:hidden;">',
    '<tr><td style="background:#1a2540;padding:24px 28px;">',
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">Fotocorp</div>',
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#eef1f8;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">News Photo Agency</div>',
    "</td></tr>",
    '<tr><td style="padding:28px 28px 8px;">',
    `<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;font-weight:700;color:#1a2540;">${escapeHtml(subject)}</h1>`,
    introHtml,
    entitlementHtml,
    changesHtml,
    credentialsHtml,
    ctaHtml,
    "</td></tr>",
    '<tr><td style="padding:8px 28px 28px;">',
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5dfd3;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">',
    FOOTER_LINES.map((line) => `<div style="margin:0 0 4px;">${escapeHtml(line)}</div>`).join(""),
    "</div></td></tr>",
    "</table></td></tr></table></body></html>",
  ].join("")
}

function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#4b5563;">${escapeHtml(text)}</p>`
}

function renderEntitlementTable(lines: EntitlementEmailLine[]): string {
  const rows = lines
    .map(
      (line) =>
        `<tr>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0d0f1a;font-weight:600;">${escapeHtml(line.assetLabel)}</td>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#4b5563;text-align:center;">${escapeHtml(String(line.allowedDownloads))}</td>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#4b5563;text-align:center;">${escapeHtml(line.qualityLabel)}</td>` +
        `</tr>`,
    )
    .join("")

  return [
    '<p style="margin:20px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#1a2540;text-transform:uppercase;letter-spacing:0.06em;">Your download limits</p>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #ede9e0;border-radius:6px;overflow:hidden;margin-bottom:20px;">',
    '<tr style="background:#f3efe8;">',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Asset type</th>',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">Downloads</th>',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">Quality</th>',
    "</tr>",
    rows,
    "</table>",
  ].join("")
}

function renderChangesTable(changes: EntitlementChangeLine[]): string {
  const rows = changes
    .map(
      (change) =>
        `<tr>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0d0f1a;">${escapeHtml(change.fieldLabel)}</td>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#9ca3af;text-align:center;text-decoration:line-through;">${escapeHtml(change.previousValue)}</td>` +
        `<td style="padding:12px 16px;border-bottom:1px solid #ede9e0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2540;font-weight:600;text-align:center;">${escapeHtml(change.newValue)}</td>` +
        `</tr>`,
    )
    .join("")

  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #ede9e0;border-radius:6px;overflow:hidden;margin:20px 0;">',
    '<tr style="background:#f3efe8;">',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Setting</th>',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">Previous</th>',
    '<th style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">New</th>',
    "</tr>",
    rows,
    "</table>",
  ].join("")
}

function renderCredentialsBlock(lines: string[]): string {
  const items = lines
    .map(
      (line) =>
        `<div style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0d0f1a;"><strong style="color:#1a2540;">${escapeHtml(line.split(": ")[0] ?? line)}:</strong> ${escapeHtml(line.split(": ").slice(1).join(": ") || "")}</div>`,
    )
    .join("")

  return [
    '<div style="background:#fdf4e3;border:1px solid #f0c96b;border-radius:6px;padding:16px 20px;margin:20px 0;">',
    items,
    "</div>",
  ].join("")
}

function renderCtaButton(label: string, url: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">',
    '<tr><td style="border-radius:6px;background:#c07c0a;">',
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>`,
    "</td></tr></table>",
  ].join("")
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

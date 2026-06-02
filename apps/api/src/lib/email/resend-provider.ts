import type { EmailEnvelope, EmailProvider, EmailSendResult } from "./types"

const RESEND_EMAILS_URL = "https://api.resend.com/emails"

interface ResendEmailResponse {
  id?: unknown
  message?: unknown
  error?: unknown
}

export function createResendEmailProvider(options: {
  apiKey: string
  fetchImpl?: typeof fetch
}): EmailProvider {
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    name: "resend",
    async send(email: EmailEnvelope): Promise<EmailSendResult> {
      try {
        const response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
          },
          body: JSON.stringify({
            from: email.from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
            reply_to: email.replyTo,
          }),
        })

        const body = await readJsonBody(response)
        if (!response.ok) {
          return {
            status: "FAILED",
            provider: "resend",
            providerMessageId: null,
            errorMessage: summarizeResendError(response.status, body),
          }
        }

        return {
          status: "SENT",
          provider: "resend",
          providerMessageId: typeof body?.id === "string" ? body.id : null,
          errorMessage: null,
        }
      } catch (error) {
        return {
          status: "FAILED",
          provider: "resend",
          providerMessageId: null,
          errorMessage: error instanceof Error ? error.message : "Resend request failed.",
        }
      }
    },
  }
}

export function createNoopEmailProvider(reason: string): EmailProvider {
  return {
    name: "console",
    async send(email: EmailEnvelope): Promise<EmailSendResult> {
      console.info("email_delivery_skipped", {
        provider: "console",
        reason,
        templateKey: email.templateKey,
        to: email.to,
        subject: email.subject,
      })
      return {
        status: "SKIPPED",
        provider: "console",
        providerMessageId: null,
        errorMessage: reason,
      }
    },
  }
}

async function readJsonBody(response: Response): Promise<ResendEmailResponse | null> {
  try {
    return (await response.json()) as ResendEmailResponse
  } catch {
    return null
  }
}

function summarizeResendError(status: number, body: ResendEmailResponse | null): string {
  if (typeof body?.message === "string") return `Resend ${status}: ${body.message}`
  if (typeof body?.error === "string") return `Resend ${status}: ${body.error}`
  return `Resend request failed with status ${status}.`
}

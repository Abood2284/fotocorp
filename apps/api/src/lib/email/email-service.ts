import { sql } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import type { Env } from "../../appTypes"
import { createNoopEmailProvider, createResendEmailProvider } from "./resend-provider"
import { renderAccessEmailTemplate } from "./templates"
import type {
  EmailDeliveryStatus,
  EmailEnv,
  EmailProvider,
  EmailRecipient,
  EmailRelatedEntity,
  EmailSendResult,
  EmailTemplateData,
  EmailTemplateKey,
} from "./types"

const DEFAULT_FROM_NAME = "Fotocorp Subscriptions"
const DEFAULT_FROM_ADDRESS = "subscription@fotocorp.com"
const DEFAULT_REPLY_TO = "subscription@fotocorp.com"
const DEFAULT_LOGIN_URL = "https://fotocorp.com"
const DEFAULT_CONTRIBUTOR_LOGIN_PATH = "/sign-in?persona=contributor"

export interface DeliverAccessEmailInput {
  templateKey: EmailTemplateKey
  recipient: EmailRecipient
  relatedEntity: EmailRelatedEntity
  data?: EmailTemplateData
}

export interface DeliverAccessEmailOptions {
  provider?: EmailProvider
  fetchImpl?: typeof fetch
  loginUrl?: string | null
  contributorLoginUrl?: string | null
}

export async function sendAccessInquiryEmail(
  db: DrizzleClient,
  env: Env,
  input: DeliverAccessEmailInput,
  options: DeliverAccessEmailOptions = {},
): Promise<EmailSendResult> {
  return deliverTemplatedEmail(db, env, input, {
    ...options,
    loginUrl: options.loginUrl ?? resolveLoginUrl(env),
    contributorLoginUrl: options.contributorLoginUrl ?? resolveContributorLoginUrl(env),
  })
}

export async function safeSendAccessInquiryEmail(
  db: DrizzleClient,
  env: Env,
  input: DeliverAccessEmailInput,
  options: DeliverAccessEmailOptions = {},
): Promise<EmailSendResult> {
  try {
    return await sendAccessInquiryEmail(db, env, input, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed."
    console.warn("email_delivery_unhandled_failure", {
      templateKey: input.templateKey,
      to: input.recipient.email,
      relatedEntityType: input.relatedEntity.type,
      relatedEntityId: input.relatedEntity.id,
      errorMessage: message,
    })
    return {
      status: "FAILED",
      provider: "unknown",
      providerMessageId: null,
      errorMessage: message,
    }
  }
}

export async function deliverTemplatedEmail(
  db: DrizzleClient,
  env: EmailEnv,
  input: DeliverAccessEmailInput,
  options: DeliverAccessEmailOptions = {},
): Promise<EmailSendResult> {
  const to = input.recipient.email.trim().toLowerCase()
  if (!to) {
    return {
      status: "SKIPPED",
      provider: "console",
      providerMessageId: null,
      errorMessage: "recipient_email_missing",
    }
  }

  const existing = await hasSuccessfulDelivery(db, input.relatedEntity, input.templateKey)
  if (existing) {
    const rendered = renderAccessEmailTemplate(input.templateKey, {
      recipient: input.recipient,
      loginUrl: options.loginUrl ?? DEFAULT_LOGIN_URL,
      data: {
        ...input.data,
        contributorLoginUrl: input.data?.contributorLoginUrl ?? options.contributorLoginUrl,
      },
    })
    await logEmailDelivery(db, {
      recipientEmail: to,
      templateKey: input.templateKey,
      subject: rendered.subject,
      provider: "console",
      providerMessageId: null,
      status: "SKIPPED",
      errorMessage: "duplicate_successful_delivery",
      relatedEntity: input.relatedEntity,
    })
    return {
      status: "SKIPPED",
      provider: "console",
      providerMessageId: null,
      errorMessage: "duplicate_successful_delivery",
    }
  }

  const rendered = renderAccessEmailTemplate(input.templateKey, {
    recipient: input.recipient,
    loginUrl: options.loginUrl ?? DEFAULT_LOGIN_URL,
    data: {
      ...input.data,
      contributorLoginUrl: input.data?.contributorLoginUrl ?? options.contributorLoginUrl,
    },
  })
  const idempotencyKey = buildEmailIdempotencyKey({
    templateKey: input.templateKey,
    relatedEntity: input.relatedEntity,
    recipientEmail: to,
  })
  const config = resolveEmailConfig(env)
  const provider = options.provider ?? createEmailProvider(env, options.fetchImpl)
  const envelope = {
    ...rendered,
    from: config.from,
    to,
    replyTo: config.replyTo,
    idempotencyKey,
  }

  const result = await provider.send(envelope)
  await logEmailDelivery(db, {
    recipientEmail: to,
    templateKey: input.templateKey,
    subject: rendered.subject,
    provider: result.provider || provider.name,
    providerMessageId: result.providerMessageId,
    status: result.status,
    errorMessage: result.errorMessage,
    relatedEntity: input.relatedEntity,
  })

  if (result.status !== "SENT") {
    console.warn("email_delivery_failed", {
      provider: result.provider || provider.name,
      templateKey: input.templateKey,
      to,
      status: result.status,
      relatedEntityType: input.relatedEntity.type,
      relatedEntityId: input.relatedEntity.id,
      errorMessage: result.errorMessage,
    })
  }

  return result
}

export function createEmailProvider(env: EmailEnv, fetchImpl?: typeof fetch): EmailProvider {
  if ((env.EMAIL_PROVIDER ?? "").trim().toLowerCase() !== "resend") {
    return createNoopEmailProvider("email_provider_not_resend")
  }
  if (!env.RESEND_API_KEY?.trim()) {
    return createNoopEmailProvider("resend_api_key_missing")
  }
  return createResendEmailProvider({ apiKey: env.RESEND_API_KEY, fetchImpl })
}

export function resolveEmailConfig(env: EmailEnv): { from: string; replyTo: string } {
  const fromName = env.EMAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME
  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim() || DEFAULT_FROM_ADDRESS
  const replyTo = env.EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO
  return {
    from: `${fromName} <${fromAddress}>`,
    replyTo,
  }
}

export function resolveLoginUrl(env: EmailEnv): string {
  const origin = env.PUBLIC_WEB_ORIGIN?.trim().replace(/\/+$/, "")
  return origin ? `${origin}/sign-in` : DEFAULT_LOGIN_URL
}

export function resolveContributorLoginUrl(env: EmailEnv): string {
  const origin = env.PUBLIC_WEB_ORIGIN?.trim().replace(/\/+$/, "")
  return origin ? `${origin}${DEFAULT_CONTRIBUTOR_LOGIN_PATH}` : `${DEFAULT_LOGIN_URL}${DEFAULT_CONTRIBUTOR_LOGIN_PATH}`
}

export function buildEmailIdempotencyKey(input: {
  templateKey: EmailTemplateKey
  relatedEntity: EmailRelatedEntity
  recipientEmail: string
}): string {
  return [
    input.templateKey,
    input.relatedEntity.type,
    input.relatedEntity.id,
    input.recipientEmail.trim().toLowerCase(),
  ].join(":")
}

async function hasSuccessfulDelivery(
  db: DrizzleClient,
  relatedEntity: EmailRelatedEntity,
  templateKey: EmailTemplateKey,
): Promise<boolean> {
  const rows = await executeRows<{ id: string }>(db, sql`
    select id
    from email_delivery_logs
    where related_entity_type = ${relatedEntity.type}
      and related_entity_id = ${relatedEntity.id}
      and template_key = ${templateKey}
      and status = 'SENT'
    limit 1
  `)
  return rows.length > 0
}

async function logEmailDelivery(
  db: DrizzleClient,
  input: {
    recipientEmail: string
    templateKey: EmailTemplateKey
    subject: string
    provider: string
    providerMessageId: string | null
    status: EmailDeliveryStatus
    errorMessage: string | null
    relatedEntity: EmailRelatedEntity
  },
): Promise<void> {
  await db.execute(sql`
    insert into email_delivery_logs (
      recipient_email,
      template_key,
      subject,
      provider,
      provider_message_id,
      status,
      error_message,
      related_entity_type,
      related_entity_id,
      sent_at
    ) values (
      ${input.recipientEmail},
      ${input.templateKey},
      ${input.subject},
      ${input.provider},
      ${input.providerMessageId},
      ${input.status},
      ${input.errorMessage},
      ${input.relatedEntity.type},
      ${input.relatedEntity.id},
      ${input.status === "SENT" ? new Date() : null}
    )
    on conflict do nothing
  `)
}

async function executeRows<T>(db: DrizzleClient, query: Parameters<DrizzleClient["execute"]>[0]): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] }).rows ?? []) as T[]
}

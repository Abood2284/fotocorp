import { sql } from "drizzle-orm"
import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db/http"
import {
  buildTypesenseCaricatureDocument,
  buildCaricaturesCollectionSchema,
  parseTypesenseCaricatureSearchConfig,
  type TypesenseCaricatureRow,
} from "./typesense-caricatures"
import {
  buildTypesenseRequestHeaders,
} from "./typesense-public-assets"

const POST_PUBLISH_SYNC_ATTEMPTS = 3
const POST_PUBLISH_SYNC_BASE_DELAY_MS = 250

export interface ScheduleTypesenseCaricatureSyncOptions {
  critical?: boolean
}

export async function scheduleTypesenseSyncForCaricature(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  options?: ScheduleTypesenseCaricatureSyncOptions,
): Promise<void> {
  const critical = Boolean(options?.critical)
  let lastError: unknown

  for (let attempt = 1; attempt <= POST_PUBLISH_SYNC_ATTEMPTS; attempt += 1) {
    try {
      await syncCaricatureDocumentOnce(db, env, assetId)
      return
    } catch (error) {
      lastError = error
      if (attempt >= POST_PUBLISH_SYNC_ATTEMPTS) break
      await sleep(POST_PUBLISH_SYNC_BASE_DELAY_MS * attempt)
    }
  }

  if (critical) throw lastError
  console.error(
    JSON.stringify({
      event: "typesense_caricature_sync_failed",
      assetId,
      errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
    }),
  )
}

async function syncCaricatureDocumentOnce(
  db: DrizzleClient,
  env: Env,
  assetId: string,
): Promise<void> {
  const config = parseTypesenseCaricatureSearchConfig(env)
  const rows = await executeCaricatureSyncRows(db, assetId)
  const row = rows[0]
  if (!row) {
    await deleteCaricatureFromTypesense(config, assetId)
    return
  }

  await ensureCaricaturesCollection(config)
  const document = buildTypesenseCaricatureDocument(row)
  await upsertCaricatureDocument(config, document)
}

async function executeCaricatureSyncRows(
  db: DrizzleClient,
  assetId: string,
): Promise<TypesenseCaricatureRow[]> {
  const result = await db.execute(sql`
    select
      ca.id::text as id,
      ca.headline,
      ca.description,
      ca.credit,
      ca.category_id::text as category_id,
      cc.name as category_name,
      ca.language,
      ca.has_visible_text,
      ca.visible_text,
      ca.visible_text_translation_en,
      ca.keywords,
      ca.depicted_subjects,
      ca.published_at,
      ca.created_at,
      ca.status,
      ca.visibility,
      card.public_url as preview_card_url,
      card.width as preview_card_width,
      card.height as preview_card_height,
      detail.public_url as preview_detail_url,
      detail.width as preview_detail_width,
      detail.height as preview_detail_height
    from caricature_assets ca
    join caricature_categories cc on cc.id = ca.category_id
    join caricature_derivatives card
      on card.caricature_id = ca.id
     and card.derivative_type = 'BLURRED_CARD'
     and card.status = 'READY'
     and card.public_url is not null
    left join caricature_derivatives detail
      on detail.caricature_id = ca.id
     and detail.derivative_type = 'BLURRED_DETAIL'
     and detail.status = 'READY'
     and detail.public_url is not null
    where ca.id = ${assetId}::uuid
      and ca.status = 'PUBLISHED'
      and ca.visibility = 'PUBLIC'
      and ca.deleted_at is null
    limit 1
  `)

  return result.rows as unknown as TypesenseCaricatureRow[]
}

async function ensureCaricaturesCollection(config: {
  host: string
  apiKey: string
  collection: string
  cloudflareAccess: { clientId: string; clientSecret: string } | null
}) {
  const lookupUrl = new URL(`/collections/${encodeURIComponent(config.collection)}`, `${config.host}/`)
  const lookup = await fetch(lookupUrl, {
    method: "GET",
    headers: buildTypesenseRequestHeaders(config),
  })
  if (lookup.ok) return
  if (lookup.status !== 404) {
    const body = await lookup.text()
    throw new Error(`Typesense collection lookup failed: HTTP ${lookup.status} ${body.slice(0, 200)}`)
  }

  const createUrl = new URL("/collections", `${config.host}/`)
  const schema = buildCaricaturesCollectionSchema(config.collection)
  const create = await fetch(createUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...buildTypesenseRequestHeaders(config),
    },
    body: JSON.stringify(schema),
  })
  if (!create.ok) {
    const body = await create.text()
    throw new Error(`Typesense collection create failed: HTTP ${create.status} ${body.slice(0, 200)}`)
  }
}

async function upsertCaricatureDocument(
  config: {
    host: string
    apiKey: string
    collection: string
    cloudflareAccess: { clientId: string; clientSecret: string } | null
  },
  document: Record<string, unknown>,
) {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents`,
    `${config.host}/`,
  )
  url.searchParams.set("action", "upsert")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...buildTypesenseRequestHeaders(config),
    },
    body: JSON.stringify(document),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Typesense caricature upsert failed: HTTP ${response.status} ${body.slice(0, 200)}`)
  }
}

async function deleteCaricatureFromTypesense(
  config: {
    host: string
    apiKey: string
    collection: string
    cloudflareAccess: { clientId: string; clientSecret: string } | null
  },
  assetId: string,
) {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/${encodeURIComponent(assetId)}`,
    `${config.host}/`,
  )
  const response = await fetch(url, {
    method: "DELETE",
    headers: buildTypesenseRequestHeaders(config),
  })
  if (response.status === 404) return
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Typesense caricature delete failed: HTTP ${response.status} ${body.slice(0, 200)}`)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

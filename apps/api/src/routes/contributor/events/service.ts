import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import type { ContributorSessionResult } from "../auth/service";
import type {
  PhotographerEventCreateBody,
  PhotographerEventPatchBody,
  PhotographerEventsListQuery,
} from "./validators";

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  event_date: Date | string | null;
  event_time: string | null;
  country: string | null;
  state_region: string | null;
  city: string | null;
  location: string | null;
  keywords: string | null;
  status: string;
  created_by_source: string;
  created_by_contributor_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export async function listPhotographerEvents(
  db: DrizzleClient,
  session: ContributorSessionResult,
  query: PhotographerEventsListQuery,
) {
  const photographerId = session.contributor.id;
  const limit = query.limit;
  const offset = query.offset;
  const search = query.q?.trim();
  const searchClause = search
    ? sql`and (
        pe.name ilike ${"%" + search + "%"}
        or pe.city ilike ${"%" + search + "%"}
        or pe.location ilike ${"%" + search + "%"}
        or pe.keywords ilike ${"%" + search + "%"}
      )`
    : sql``;

  const scopeClause =
    query.scope === "mine"
      ? sql`pe.created_by_contributor_id = ${photographerId}::uuid`
      : sql`pe.status = 'ACTIVE'`;

  const countRows = await executeRows<{ total: string }>(
    db,
    sql`
      select count(*)::text as total
      from photo_events pe
      where ${scopeClause}
      ${searchClause}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0) || 0;

  const rows = await executeRows<EventRow>(
    db,
    sql`
      select
        pe.id,
        pe.name,
        pe.description,
        pe.event_date,
        pe.event_time,
        pe.country,
        pe.state_region,
        pe.city,
        pe.location,
        pe.keywords,
        pe.status,
        pe.created_by_source,
        pe.created_by_contributor_id,
        pe.created_at,
        pe.updated_at
      from photo_events pe
      where ${scopeClause}
      ${searchClause}
      order by pe.event_date desc nulls last, pe.created_at desc, pe.id desc
      limit ${limit}
      offset ${offset}
    `,
  );

  return {
    ok: true as const,
    events: rows.map((row) => mapEvent(row, photographerId)),
    pagination: { limit, offset, total },
  };
}

export async function getPhotographerEvent(db: DrizzleClient, session: ContributorSessionResult, eventId: string) {
  const photographerId = session.contributor.id;
  const rows = await executeRows<EventRow>(
    db,
    sql`
      select
        pe.id,
        pe.name,
        pe.description,
        pe.event_date,
        pe.event_time,
        pe.country,
        pe.state_region,
        pe.city,
        pe.location,
        pe.keywords,
        pe.status,
        pe.created_by_source,
        pe.created_by_contributor_id,
        pe.created_at,
        pe.updated_at
      from photo_events pe
      where pe.id = ${eventId}::uuid
        and (pe.status = 'ACTIVE' or pe.created_by_contributor_id = ${photographerId}::uuid)
      limit 1
    `,
  );
  const row = rows[0];
  if (!row) throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found.");
  return { ok: true as const, event: mapEvent(row, photographerId) };
}

export async function createPhotographerEvent(
  db: DrizzleClient,
  session: ContributorSessionResult,
  body: PhotographerEventCreateBody,
) {
  const photographerId = session.contributor.id;
  const accountId = session.account.id;
  const eventDateSql = parseEventDateForSql(body.eventDate);

  const inserted = await executeRows<EventRow>(
    db,
    sql`
      insert into photo_events (
        name,
        description,
        event_date,
        event_time,
        country,
        state_region,
        city,
        location,
        keywords,
        status,
        source,
        created_by_contributor_id,
        created_by_contributor_account_id,
        created_by_source
      )
      values (
        ${body.name},
        ${body.description ?? null},
        ${eventDateSql},
        ${body.eventTime ?? null},
        ${body.country ?? null},
        ${body.stateRegion ?? null},
        ${body.city ?? null},
        ${body.location ?? null},
        ${body.keywords ?? null},
        'ACTIVE',
        'PHOTOGRAPHER',
        ${photographerId}::uuid,
        ${accountId}::uuid,
        'PHOTOGRAPHER'
      )
      returning
        id,
        name,
        description,
        event_date,
        event_time,
        country,
        state_region,
        city,
        location,
        keywords,
        status,
        created_by_source,
        created_by_contributor_id,
        created_at,
        updated_at
    `,
  );
  const row = inserted[0];
  if (!row) throw new AppError(500, "EVENT_CREATE_FAILED", "Could not create event.");
  return { ok: true as const, event: mapEvent(row, photographerId) };
}

export async function patchPhotographerEvent(
  db: DrizzleClient,
  session: ContributorSessionResult,
  eventId: string,
  body: PhotographerEventPatchBody,
) {
  const photographerId = session.contributor.id;
  const ownerRows = await executeRows<{ id: string }>(
    db,
    sql`
      select id
      from photo_events
      where id = ${eventId}::uuid
        and created_by_contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  if (!ownerRows[0]) {
    const exists = await executeRows<{ id: string }>(
      db,
      sql`select id from photo_events where id = ${eventId}::uuid limit 1`,
    );
    if (!exists[0]) throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found.");
    throw new AppError(403, "EVENT_EDIT_FORBIDDEN", "You can only edit events you created.");
  }

  const sets: SQL[] = [];
  if (body.name !== undefined) sets.push(sql`name = ${body.name}`);
  if (body.description !== undefined) sets.push(sql`description = ${body.description}`);
  if (body.eventDate !== undefined) sets.push(sql`event_date = ${parseEventDateForSql(body.eventDate)}`);
  if (body.eventTime !== undefined) sets.push(sql`event_time = ${body.eventTime}`);
  if (body.country !== undefined) sets.push(sql`country = ${body.country}`);
  if (body.stateRegion !== undefined) sets.push(sql`state_region = ${body.stateRegion}`);
  if (body.city !== undefined) sets.push(sql`city = ${body.city}`);
  if (body.location !== undefined) sets.push(sql`location = ${body.location}`);
  if (body.keywords !== undefined) sets.push(sql`keywords = ${body.keywords}`);
  if (sets.length === 0) throw new AppError(400, "EVENT_NOTHING_TO_UPDATE", "No valid fields to update.");

  await db.execute(sql`
    update photo_events
    set ${sql.join(sets, sql`, `)}, updated_at = now()
    where id = ${eventId}::uuid
  `);

  return getPhotographerEvent(db, session, eventId);
}

function mapEvent(row: EventRow, currentPhotographerId: string) {
  const canEdit = row.created_by_contributor_id === currentPhotographerId;
  return {
    id: row.id,
    name: row.name,
    eventDate: row.event_date ? dateOnlyIso(row.event_date) : null,
    eventTime: row.event_time,
    country: row.country,
    stateRegion: row.state_region,
    city: row.city,
    location: row.location,
    keywords: row.keywords,
    description: row.description,
    status: row.status,
    createdBySource: row.created_by_source,
    canEdit,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function dateOnlyIso(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseEventDateForSql(isoDate: string | undefined): string | null {
  if (!isoDate) return null;
  return `${isoDate}T12:00:00.000Z`;
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

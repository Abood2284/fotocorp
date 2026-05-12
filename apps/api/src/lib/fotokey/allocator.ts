import { sql } from "drizzle-orm";
import type { TransactionalDrizzleClient } from "../../db";

const MIN_SEQUENCE_DIGITS = 3;

/**
 * Format a Fotokey for a given approval business date and sequence number.
 *
 * Format: `FC + DD + MM + YY + sequence` where sequence is zero-padded to at least 3 digits.
 * Sequences may grow beyond 999 — `FC0101261000` is valid.
 *
 * @example formatFotokey("2026-01-01", 1) === "FC010126001"
 * @example formatFotokey("2026-01-01", 25) === "FC010126025"
 * @example formatFotokey("2026-01-01", 1000) === "FC0101261000"
 */
export function formatFotokey(approvalDateIso: string, sequence: number): string {
  const dd = approvalDateIso.slice(8, 10);
  const mm = approvalDateIso.slice(5, 7);
  const yy = approvalDateIso.slice(2, 4);
  const seq = String(sequence).padStart(MIN_SEQUENCE_DIGITS, "0");
  return `FC${dd}${mm}${yy}${seq}`;
}

/**
 * Returns the business approval date in `Asia/Kolkata` (IST) for the given Date instance.
 *
 * Fotokey sequence is global per IST approval date, regardless of how many contributors
 * or events contribute on that day. We use IST because the Fotocorp business operates
 * primarily out of India.
 */
export function approvalBusinessDateIst(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export interface AllocateFotokeysInput {
  count: number;
  approvalDateIso: string;
}

export interface AllocatedFotokey {
  approvalDateIso: string;
  sequence: number;
  fotokey: string;
}

/**
 * Reserves `count` consecutive Fotokey sequence numbers under the `code_date` row, in a single
 * transaction with row-level locking, then returns the formatted Fotokeys in ascending order.
 *
 * The caller is responsible for assigning the returned Fotokeys to image assets in the EXACT
 * order they were requested by the admin (admin-selected order is the publish/business order).
 *
 * Important: this function must be called from within a single Postgres connection / transaction.
 * Callers should use `createTransactionalDb` so we can issue `select for update` on the counter
 * row, then update it within the same transaction.
 */
export async function allocateFotokeysForApproval(
  db: TransactionalDrizzleClient,
  input: AllocateFotokeysInput,
): Promise<AllocatedFotokey[]> {
  if (input.count <= 0) return [];
  if (!Number.isInteger(input.count)) {
    throw new Error("Fotokey allocator count must be a positive integer.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into fotokey_daily_counters (code_date, last_sequence)
      values (${input.approvalDateIso}::date, 0)
      on conflict (code_date) do nothing
    `);

    const lockResult = await tx.execute(sql`
      select last_sequence
      from fotokey_daily_counters
      where code_date = ${input.approvalDateIso}::date
      for update
    `);
    const lockRow = readFirstRow<{ last_sequence: number | string }>(lockResult);
    const previous = Number(lockRow?.last_sequence ?? 0) || 0;
    const next = previous + input.count;

    await tx.execute(sql`
      update fotokey_daily_counters
      set last_sequence = ${next},
          updated_at = now()
      where code_date = ${input.approvalDateIso}::date
    `);

    const allocations: AllocatedFotokey[] = [];
    for (let i = 1; i <= input.count; i += 1) {
      const sequence = previous + i;
      allocations.push({
        approvalDateIso: input.approvalDateIso,
        sequence,
        fotokey: formatFotokey(input.approvalDateIso, sequence),
      });
    }
    return allocations;
  });
}

function readFirstRow<T>(result: unknown): T | null {
  if (Array.isArray(result)) return (result[0] as T) ?? null;
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return (rows[0] as T) ?? null;
  }
  return null;
}

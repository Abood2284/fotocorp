import { sql } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import type { StaffPublicProfile } from "../auth/service";
import { hashStaffPassword, validateStaffPasswordLength } from "../../../lib/auth/staff-password";

export async function listStaffUsers(db: DrizzleClient, staff: StaffPublicProfile) {
  if (staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can manage staff accounts.");
  }

  const rows = await db.execute<{
    id: string;
    username: string;
    display_name: string;
    role: string;
    status: string;
    last_login_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }>(sql`
    select id, username, display_name, role, status, last_login_at, created_at, updated_at
    from staff_accounts
    order by created_at desc
  `);

  return {
    items: rows.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      lastLoginAt: row.last_login_at instanceof Date ? row.last_login_at.toISOString() : row.last_login_at,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    })),
  };
}

export async function createStaffUser(
  db: DrizzleClient,
  staff: StaffPublicProfile,
  input: { username: string; displayName: string; role: string; passwordPlain: string }
) {
  if (staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can create staff accounts.");
  }

  const pwError = validateStaffPasswordLength(input.passwordPlain);
  if (pwError) {
    throw new AppError(400, "INVALID_PASSWORD", pwError);
  }

  const passwordHash = await hashStaffPassword(input.passwordPlain);

  try {
    const res = await db.execute<{ id: string }>(sql`
      insert into staff_accounts (
        username, display_name, role, password_hash, created_by_staff_id
      ) values (
        ${input.username.trim().toLowerCase()},
        ${input.displayName.trim()},
        ${input.role},
        ${passwordHash},
        ${staff.id}
      ) returning id
    `);
    
    return { id: res.rows[0].id };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      throw new AppError(409, "USERNAME_TAKEN", "This username is already taken.");
    }
    throw err;
  }
}

export async function updateStaffRole(
  db: DrizzleClient,
  staff: StaffPublicProfile,
  staffId: string,
  newRole: string
) {
  if (staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can edit staff roles.");
  }

  const res = await db.execute<{ id: string }>(sql`
    update staff_accounts
    set role = ${newRole}, updated_at = now()
    where id = ${staffId}
    returning id
  `);

  if (!res.rows.length) throw new AppError(404, "USER_NOT_FOUND", "Staff account not found.");
  return { id: res.rows[0].id };
}

export async function setStaffStatus(
  db: DrizzleClient,
  staff: StaffPublicProfile,
  staffId: string,
  status: "ACTIVE" | "DISABLED"
) {
  if (staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can change staff status.");
  }

  if (staff.id === staffId && status === "DISABLED") {
    throw new AppError(400, "CANNOT_DISABLE_SELF", "You cannot disable your own account.");
  }

  const res = await db.execute<{ id: string }>(sql`
    update staff_accounts
    set status = ${status}, updated_at = now()
    where id = ${staffId}
    returning id
  `);

  if (!res.rows.length) throw new AppError(404, "USER_NOT_FOUND", "Staff account not found.");
  
  if (status === "DISABLED") {
    // Optionally revoke active sessions for this disabled staff account.
    await db.execute(sql`
      update staff_sessions
      set revoked_at = now()
      where staff_account_id = ${staffId} and revoked_at is null
    `);
  }

  return { id: res.rows[0].id };
}

export async function resetStaffPassword(
  db: DrizzleClient,
  staff: StaffPublicProfile,
  staffId: string,
  newPasswordPlain: string
) {
  if (staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can reset staff passwords.");
  }

  const pwError = validateStaffPasswordLength(newPasswordPlain);
  if (pwError) {
    throw new AppError(400, "INVALID_PASSWORD", pwError);
  }

  const passwordHash = await hashStaffPassword(newPasswordPlain);

  const res = await db.execute<{ id: string }>(sql`
    update staff_accounts
    set password_hash = ${passwordHash}, updated_at = now(), password_updated_at = now()
    where id = ${staffId}
    returning id
  `);

  if (!res.rows.length) throw new AppError(404, "USER_NOT_FOUND", "Staff account not found.");
  
  // Revoke all existing sessions so they must re-authenticate.
  await db.execute(sql`
    update staff_sessions
    set revoked_at = now()
    where staff_account_id = ${staffId} and revoked_at is null
  `);

  return { id: res.rows[0].id };
}

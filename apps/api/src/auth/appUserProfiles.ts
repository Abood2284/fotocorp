import { neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import type { Env } from "../appTypes";
import { createHttpDb } from "../db";
import { appUserProfiles, betterAuthUsers } from "../db/schema";

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

export interface AuthUserProfileInput {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export async function upsertAppUserProfile(env: Env, authUser: AuthUserProfileInput) {
  const db = dbFor(env);
  const bootstrapRole = getBootstrapRole(env, authUser.email);

  await db
    .insert(appUserProfiles)
    .values({
      id: crypto.randomUUID(),
      authUserId: authUser.id,
      email: authUser.email,
      displayName: authUser.name ?? null,
      avatarUrl: authUser.image ?? null,
      role: "USER",
      status: "ACTIVE",
    })
    .onConflictDoUpdate({
      target: appUserProfiles.authUserId,
      set: {
        email: authUser.email,
        displayName: authUser.name ?? null,
        avatarUrl: authUser.image ?? null,
        updatedAt: new Date(),
      },
    });

  if (bootstrapRole === "SUPER_ADMIN") {
    await db
      .update(appUserProfiles)
      .set({ role: "SUPER_ADMIN" })
      .where(eq(appUserProfiles.authUserId, authUser.id));
  }
}

export async function upsertAppUserProfileByAuthUserId(env: Env, authUserId: string) {
  const db = dbFor(env);
  const result = await db
    .select({
      id: betterAuthUsers.id,
      email: betterAuthUsers.email,
      name: betterAuthUsers.name,
      image: betterAuthUsers.image,
    })
    .from(betterAuthUsers)
    .where(eq(betterAuthUsers.id, authUserId))
    .limit(1);

  const authUser = result[0];
  if (!authUser) return;

  await upsertAppUserProfile(env, authUser);
}

function dbFor(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL binding is required for auth profile access.");
  }
  return createHttpDb(env.DATABASE_URL);
}

function getBootstrapRole(env: Env, email: string) {
  const superAdminEmail = env.FOTOCORP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();

  if (superAdminEmail && email.trim().toLowerCase() === superAdminEmail) {
    return "SUPER_ADMIN";
  }

  return "USER";
}

import { Pool, neonConfig } from "@neondatabase/serverless";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins/username";
import { createAuthMiddleware } from "better-auth/api";
import type { Env } from "../appTypes";
import { createHttpDb } from "../db";
import { createBusinessEmailValidationRepository } from "../routes/auth/services/business-email-validation";
import {
  createFotocorpUserProfile,
  RegistrationProfileValidationError,
  type ValidatedRegistrationProfile,
  validateRegistrationProfileBody,
} from "../routes/auth/services/fotocorp-registration-profile";
import { upsertAppUserProfileByAuthUserId } from "./appUserProfiles";
import { isValidUsername, normalizeUsername } from "./username";

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const FOTOCORP_PROFILE_BODY_KEY = "__fotocorpRegistrationProfile";

export function getAuth(env: Env) {
  const databaseUrl = requireEnv(env.DATABASE_URL, "DATABASE_URL");
  const baseURL = requireEnv(env.BETTER_AUTH_URL, "BETTER_AUTH_URL");
  const secret = requireEnv(env.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET");
  return createFotocorpAuth({ env, databaseUrl, baseURL, secret });
}

function createFotocorpAuth({
  env,
  databaseUrl,
  baseURL,
  secret,
}: {
  env: Env;
  databaseUrl: string;
  baseURL: string;
  secret: string;
}) {
  return betterAuth({
    appName: "Fotocorp",
    baseURL,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [baseURL],
    database: new Pool({ connectionString: databaseUrl }),
    emailAndPassword: {
      enabled: true,
      // TODO(auth-email): Wire Better Auth password reset email delivery after a production mailer exists.
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;

        const body = ctx.body as Record<string, unknown>;
        let profile: ValidatedRegistrationProfile;
        try {
          profile = await validateRegistrationProfileBody(body, {
            emailRepository: createBusinessEmailValidationRepository(createHttpDb(databaseUrl)),
          });
        } catch (error) {
          if (!(error instanceof RegistrationProfileValidationError)) throw error;
          throw APIError.from("BAD_REQUEST", {
            code: error.code,
            message: error.message,
          });
        }

        body.username = normalizeUsername(profile.username);
        body[FOTOCORP_PROFILE_BODY_KEY] = profile;
      }),
    },
    databaseHooks: {
      user: {
        create: {
          async after(user, context) {
            const profile = readPreparedRegistrationProfile(context?.body);
            const userId = typeof user?.id === "string" ? user.id : null;
            if (!profile || !userId) return;

            await createFotocorpUserProfile(createHttpDb(databaseUrl), userId, profile);
          },
        },
      },
      session: {
        create: {
          async after(session) {
            if (session.userId) {
              await upsertAppUserProfileByAuthUserId(env, session.userId);
            }
          },
        },
      },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameNormalization: normalizeUsername,
        usernameValidator: isValidUsername,
        validationOrder: {
          username: "post-normalization",
        },
      }),
    ],
  });
}

function readPreparedRegistrationProfile(body: unknown): ValidatedRegistrationProfile | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const profile = (body as Record<string, unknown>)[FOTOCORP_PROFILE_BODY_KEY];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;

  return profile as ValidatedRegistrationProfile;
}

function requireEnv(value: string | undefined, name: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} binding is required for Better Auth.`);
  }
  return trimmed;
}

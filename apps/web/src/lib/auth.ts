import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins/username"
import { upsertAppUserProfileByAuthUserId } from "@/lib/app-user-profile-store"
import { getPgPool } from "@/lib/db"
import { isValidUsername, normalizeUsername } from "@/lib/username"

export const auth = betterAuth({
  appName: "Fotocorp",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: getPgPool(),
  emailAndPassword: {
    enabled: true,
    // TODO(auth-email): Wire Better Auth password reset email delivery after a production mailer exists.
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return

      const body = ctx.body as { username?: unknown }
      const username = typeof body.username === "string" ? normalizeUsername(body.username) : ""

      if (!username || !isValidUsername(username)) {
        throw APIError.from("BAD_REQUEST", {
          code: "INVALID_USERNAME",
          message: "Username must be 3 to 30 characters and contain only letters, numbers, underscores, or dots.",
        })
      }

      body.username = username
    }),
  },
  databaseHooks: {
    session: {
      create: {
        async after(session) {
          if (session.userId) {
            await upsertAppUserProfileByAuthUserId(session.userId)
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
    nextCookies(),
  ],
})

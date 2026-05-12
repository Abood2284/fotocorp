import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { getAuth } from "../../auth/auth";
import { createHttpDb } from "../../db";
import { AppError } from "../../lib/errors";
import { errorResponse, json } from "../../lib/http";
import {
  getFotocorpUserProfileByUserId,
  toFotocorpUserProfileDto,
} from "./services/fotocorp-registration-profile";

export const authProfileRoutes = new Hono<{ Bindings: Env }>();

authProfileRoutes.get("/api/v1/auth/me", async (c) => {
  if (!c.env.DATABASE_URL) {
    return errorResponse(
      new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured."),
    );
  }

  const session = await getAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user?.id) {
    return errorResponse(
      new AppError(401, "AUTH_REQUIRED", "Authentication is required."),
    );
  }

  const db = createHttpDb(c.env.DATABASE_URL);
  const profile = await getFotocorpUserProfileByUserId(db, session.user.id);

  if (!profile) {
    return errorResponse(
      new AppError(404, "PROFILE_NOT_FOUND", "Registration profile was not found."),
    );
  }

  const user = session.user as {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
  };

  return json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      username: user.username ?? profile.username,
    },
    profile: toFotocorpUserProfileDto(profile),
  });
});

authProfileRoutes.all("/api/v1/auth/me", () => {
  return errorResponse(
    new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route."),
  );
});

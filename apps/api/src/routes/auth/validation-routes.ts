import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { createHttpDb } from "../../db";
import { AppError } from "../../lib/errors";
import { errorResponse, json } from "../../lib/http";
import {
  createBusinessEmailValidationRepository,
  validateBusinessEmail,
} from "./services/business-email-validation";

export const authValidationRoutes = new Hono<{ Bindings: Env }>();

authValidationRoutes.post("/api/v1/auth/business-email/validate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return json({
      ok: false,
      decision: "BLOCK_INVALID_EMAIL",
      message: "Please enter a valid email address.",
    }, 400);
  }

  const email = typeof body === "object" && body && "email" in body ? String(body.email ?? "") : "";
  const result = await validateBusinessEmail(email, {
    repository: createBusinessEmailValidationRepository(db(c.env)),
  });

  return json({
    ok: result.ok,
    decision: result.decision,
    message: result.message,
  }, result.ok ? 200 : 400);
});

authValidationRoutes.all("/api/v1/auth/business-email/validate", () => {
  return errorResponse(
    new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route."),
  );
});

function db(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  }
  return createHttpDb(env.DATABASE_URL);
}

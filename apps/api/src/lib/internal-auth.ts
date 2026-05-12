import type { Env } from "../appTypes";
import { AppError } from "./errors";

const INTERNAL_SECRET_HEADER = "x-internal-api-secret";

export function requireInternalApiSecret(request: Request, env: Env): void {
  const expected = env.INTERNAL_API_SECRET?.trim();
  if (!expected) {
    throw new AppError(500, "INTERNAL_AUTH_MISCONFIGURED", "Internal API is not configured.");
  }

  const provided = request.headers.get(INTERNAL_SECRET_HEADER);
  if (!provided) {
    throw new AppError(401, "INTERNAL_AUTH_REQUIRED", "Internal API authorization failed.");
  }

  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  if (!constantTimeEqual(left, right)) {
    throw new AppError(401, "INTERNAL_AUTH_REQUIRED", "Internal API authorization failed.");
  }
}

export const INTERNAL_API_SECRET_HEADER = INTERNAL_SECRET_HEADER;

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

import type { Context } from "hono"
import { AppError } from "./errors"

export interface ZodValidationIssue {
  path: string
  message: string
}

interface ZodIssueLike {
  path: PropertyKey[]
  message: string
}

interface ZodFailureLike {
  issues: ZodIssueLike[]
}

export function zodValidationHook<T>(
  result: { success: true; data: T } | { success: false; error: ZodFailureLike },
  _c: Context,
): void {
  if (result.success) return

  const issues: ZodValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }))

  throw new AppError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { issues })
}

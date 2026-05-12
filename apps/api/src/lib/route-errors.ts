import { AppError } from "./errors"
import { errorResponse } from "./http"

export function methodNotAllowed() {
  return errorResponse(
    new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route."),
  )
}

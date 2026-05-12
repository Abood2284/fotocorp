import "server-only"

export {
  internalApiFetch,
  internalApiJson,
  InternalApiRequestError,
} from "@/lib/server/internal-api/client"
export { readInternalApiError } from "@/lib/server/internal-api/errors"
export { internalApiRoutes, withQuery } from "@/lib/server/internal-api/routes"

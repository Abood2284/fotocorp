import type { CatalogService } from "../../../services/catalogService";
import { json } from "../../../lib/http";

export async function searchRoute(
  service: CatalogService,
  request: Request
): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return json(await service.searchAssets(query));
}

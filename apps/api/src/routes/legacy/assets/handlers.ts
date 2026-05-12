import type { CatalogService } from "../../../services/catalogService";
import { json } from "../../../lib/http";

export async function listAssetsRoute(service: CatalogService): Promise<Response> {
  return json(await service.listAssets());
}

export async function getAssetRoute(
  service: CatalogService,
  assetId: string
): Promise<Response> {
  return json(await service.getAssetById(assetId));
}

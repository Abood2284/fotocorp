import { json } from "../../../lib/http";
import type { AdminService } from "../../../services/adminService";

export async function listAdminAssetsRoute(service: AdminService): Promise<Response> {
  return json(await service.listAssets());
}

export async function getAdminAssetRoute(
  service: AdminService,
  assetId: string
): Promise<Response> {
  return json(await service.getAssetById(assetId));
}

export async function listIngestionRunsRoute(
  service: AdminService
): Promise<Response> {
  return json(await service.listIngestionRuns());
}

export async function getIngestionRunRoute(
  service: AdminService,
  runId: string
): Promise<Response> {
  return json(await service.getIngestionRunById(runId));
}

import type { IngestionRunDetail } from "../../../../../packages/shared/src";
import type { FixtureAssetRecord } from "../../lib/fixtures";

export interface CatalogRepository {
  listAssets(): Promise<FixtureAssetRecord[]>;
  getAssetById(id: string): Promise<FixtureAssetRecord | null>;
  searchAssets(query: string): Promise<FixtureAssetRecord[]>;
  listIngestionRuns(): Promise<IngestionRunDetail[]>;
  getIngestionRunById(id: string): Promise<IngestionRunDetail | null>;
}

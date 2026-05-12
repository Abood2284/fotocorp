import {
  sampleIngestionRuns,
  type IngestionRunDetail
} from "../../../../../packages/shared/src";
import {
  fixtureAssets,
  type FixtureAssetRecord
} from "../../lib/fixtures";
import type { CatalogRepository } from "./catalogRepository";

export class FixtureCatalogRepository implements CatalogRepository {
  async listAssets(): Promise<FixtureAssetRecord[]> {
    return fixtureAssets;
  }

  async getAssetById(id: string): Promise<FixtureAssetRecord | null> {
    return fixtureAssets.find((asset) => asset.id === id) ?? null;
  }

  async searchAssets(query: string): Promise<FixtureAssetRecord[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return fixtureAssets.filter((asset) => {
      const haystacks = [
        asset.id,
        asset.title,
        asset.filename,
        asset.description,
        asset.collection,
        asset.location ?? "",
        ...asset.tags
      ];

      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }

  async listIngestionRuns(): Promise<IngestionRunDetail[]> {
    return sampleIngestionRuns;
  }

  async getIngestionRunById(id: string): Promise<IngestionRunDetail | null> {
    return sampleIngestionRuns.find((run) => run.id === id) ?? null;
  }
}

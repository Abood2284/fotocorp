/**
 * Placeholder for R2 staging → canonical copy and derivative writes.
 * Real S3/R2 SDK usage will live here in a follow-up PR.
 */

export class StorageService {
  /** Copy an approved staging original into the canonical originals bucket (Fotokey key). */
  async copyStagingOriginalToCanonical(): Promise<never> {
    throw new Error("Not implemented: StorageService.copyStagingOriginalToCanonical")
  }

  /** Read bytes for a canonical or staging original (internal use only). */
  async readOriginal(): Promise<never> {
    throw new Error("Not implemented: StorageService.readOriginal")
  }

  /** Persist a generated preview/derivative object. */
  async writeDerivative(): Promise<never> {
    throw new Error("Not implemented: StorageService.writeDerivative")
  }
}

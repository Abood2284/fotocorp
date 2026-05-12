/**
 * Image transforms for publish pipeline (Node only).
 *
 * Native Sharp belongs in this Node jobs package, not in Cloudflare Worker runtime packages.
 */

export class ImageProcessor {
  async generatePreviewDerivative(): Promise<never> {
    throw new Error("Not implemented: ImageProcessor.generatePreviewDerivative")
  }
}

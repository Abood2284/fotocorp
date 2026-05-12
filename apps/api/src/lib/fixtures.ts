export interface FixtureAssetRecord {
  id: string;
  title: string;
  filename: string;
  previewUrl: string;
  thumbnailUrl: string;
  downloadUrl: string;
  mediaType: "image";
  createdAt: string;
  capturedAt: string | null;
  width: number;
  height: number;
  description: string;
  tags: string[];
  collection: string;
  location: string | null;
  visibility: "public" | "internal";
  ingestionStatus: "indexed" | "processing" | "failed";
  ingestionRunId: string;
  storageKey: string;
  checksumSha256: string;
  sourceFilename: string;
  metadata: Record<string, string | number | boolean | null>;
}

export const fixtureAssets: FixtureAssetRecord[] = [
  {
    id: "asset_01HQKX8Q3R5N8EVTQ7V0P9ABCD",
    title: "Mumbai Street Portrait",
    filename: "mumbai-street-portrait.jpg",
    previewUrl: "https://fixtures.fotocorp.test/assets/mumbai-street-portrait/preview.jpg",
    thumbnailUrl: "https://fixtures.fotocorp.test/assets/mumbai-street-portrait/thumb.jpg",
    downloadUrl: "https://fixtures.fotocorp.test/assets/mumbai-street-portrait/original.jpg",
    mediaType: "image",
    createdAt: "2026-03-11T08:12:00.000Z",
    capturedAt: "2026-03-10T18:42:13.000Z",
    width: 4032,
    height: 3024,
    description: "Editorial portrait captured during an evening street session.",
    tags: ["portrait", "street", "mumbai"],
    collection: "Spring Campaign",
    location: "Mumbai, IN",
    visibility: "public",
    ingestionStatus: "indexed",
    ingestionRunId: "run_01HQKWS7YQ5D0C8TQ88J4D7P2Y",
    storageKey: "fixtures/2026/03/mumbai-street-portrait.jpg",
    checksumSha256: "5a894d7f2d0b40eaa3afc7ad8772e715f88de7e07d1985ed2cfa9d218e955101",
    sourceFilename: "IMG_1042.CR3",
    metadata: {
      cameraModel: "Canon EOS R6 Mark II",
      lens: "RF24-70mm F2.8 L IS USM",
      iso: 800,
      reviewed: true
    }
  },
  {
    id: "asset_01HQKXA3M7JZ8NEC6S6P1RF2KQ",
    title: "Studio Product Flatlay",
    filename: "studio-product-flatlay.jpg",
    previewUrl: "https://fixtures.fotocorp.test/assets/studio-product-flatlay/preview.jpg",
    thumbnailUrl: "https://fixtures.fotocorp.test/assets/studio-product-flatlay/thumb.jpg",
    downloadUrl: "https://fixtures.fotocorp.test/assets/studio-product-flatlay/original.jpg",
    mediaType: "image",
    createdAt: "2026-03-13T10:00:00.000Z",
    capturedAt: "2026-03-12T09:15:44.000Z",
    width: 6000,
    height: 4000,
    description: "Top-down catalog image for the April merchandising lineup.",
    tags: ["product", "studio", "flatlay"],
    collection: "Catalog Refresh",
    location: null,
    visibility: "public",
    ingestionStatus: "indexed",
    ingestionRunId: "run_01HQKWS7YQ5D0C8TQ88J4D7P2Y",
    storageKey: "fixtures/2026/03/studio-product-flatlay.jpg",
    checksumSha256: "9160dce6dbcc48b58b1acd7e53d111296e7840e4e4b0ea76b7f5be684b9a59cb",
    sourceFilename: "flatlay-master.tif",
    metadata: {
      lightingSetup: "softbox-overhead",
      background: "warm-stone",
      reviewed: true
    }
  },
  {
    id: "asset_01HQKXBB2F29WEMH62K91HZVR2",
    title: "Archive Contact Sheet",
    filename: "archive-contact-sheet.jpg",
    previewUrl: "https://fixtures.fotocorp.test/assets/archive-contact-sheet/preview.jpg",
    thumbnailUrl: "https://fixtures.fotocorp.test/assets/archive-contact-sheet/thumb.jpg",
    downloadUrl: "https://fixtures.fotocorp.test/assets/archive-contact-sheet/original.jpg",
    mediaType: "image",
    createdAt: "2026-03-14T14:22:00.000Z",
    capturedAt: null,
    width: 2400,
    height: 3200,
    description: "Internal archive proof sheet pending metadata review.",
    tags: ["archive", "proof", "internal"],
    collection: "Historical Digitization",
    location: null,
    visibility: "internal",
    ingestionStatus: "processing",
    ingestionRunId: "run_01HQKWVT3AX4W4TE1P90VJ59MP",
    storageKey: "fixtures/2026/03/archive-contact-sheet.jpg",
    checksumSha256: "24e88cc8c5b7c5ddac236ba0daaf181928c0ce2f430d0cf89f58c8fb6d5a0ed3",
    sourceFilename: "scan-contact-sheet-07.tif",
    metadata: {
      operator: "digitization-batch-a",
      qcPassed: false,
      dpi: 600
    }
  }
];

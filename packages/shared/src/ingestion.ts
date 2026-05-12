export type IngestionRunStatus = "queued" | "running" | "completed" | "failed";

export interface IngestionRunCounts {
  discoveredCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface IngestionRunErrorEntry {
  id: string;
  stage: "mapping" | "validation" | "import";
  code: string;
  message: string;
  assetKey: string | null;
  occurredAt: string;
}

export interface IngestionRunSummary {
  id: string;
  source: string;
  status: IngestionRunStatus;
  startedAt: string;
  completedAt: string | null;
  counts: IngestionRunCounts;
  triggeredBy: string;
}

export interface IngestionRunDetail extends IngestionRunSummary {
  errors: IngestionRunErrorEntry[];
  notes: string[];
}

export const sampleIngestionRuns: IngestionRunDetail[] = [
  {
    id: "run_01HQKWS7YQ5D0C8TQ88J4D7P2Y",
    source: "dropbox/imports/2026-03-12/",
    status: "completed",
    startedAt: "2026-03-12T04:00:00.000Z",
    completedAt: "2026-03-12T04:08:12.000Z",
    counts: {
      discoveredCount: 42,
      importedCount: 40,
      skippedCount: 0,
      failedCount: 2
    },
    triggeredBy: "scheduler",
    errors: [
      {
        id: "err_01HQKXJ8YZ0M5FBRM0W1T9V9J1",
        stage: "validation",
        code: "MISSING_CAPTURE_DATE",
        message: "Capture date could not be derived from EXIF or filename.",
        assetKey: "dropbox/imports/2026-03-12/IMG_1049.CR3",
        occurredAt: "2026-03-12T04:02:10.000Z"
      },
      {
        id: "err_01HQKXKAYQ7B6A1J8K3SR2HYXV",
        stage: "import",
        code: "PREVIEW_GENERATION_TIMEOUT",
        message: "Preview generation exceeded the provisional sample timeout budget.",
        assetKey: "dropbox/imports/2026-03-12/IMG_1050.CR3",
        occurredAt: "2026-03-12T04:06:44.000Z"
      }
    ],
    notes: [
      "Sample fixture run used to model a successful operator-visible import.",
      "Real import persistence will plug in after repository and Neon schema decisions settle."
    ]
  },
  {
    id: "run_01HQKWVT3AX4W4TE1P90VJ59MP",
    source: "s3://fotocorp-archive-scans/batch-07/",
    status: "running",
    startedAt: "2026-03-14T13:58:00.000Z",
    completedAt: null,
    counts: {
      discoveredCount: 120,
      importedCount: 97,
      skippedCount: 11,
      failedCount: 0
    },
    triggeredBy: "admin@fotocorp.test",
    errors: [],
    notes: [
      "Run is intentionally left active to exercise operator UI for in-progress ingestion."
    ]
  },
  {
    id: "run_01HQKWZ8TRM7HXFJ3SRF7X6BNE",
    source: "uploader/manual/legacy-import/",
    status: "failed",
    startedAt: "2026-03-15T09:30:00.000Z",
    completedAt: "2026-03-15T09:31:48.000Z",
    counts: {
      discoveredCount: 17,
      importedCount: 6,
      skippedCount: 0,
      failedCount: 11
    },
    triggeredBy: "ops@fotocorp.test",
    errors: [
      {
        id: "err_01HQKXQ5EQAY1VQJTFM4WDMFNF",
        stage: "mapping",
        code: "UNSUPPORTED_SOURCE_LAYOUT",
        message: "Directory layout did not match the current sample mapping profile.",
        assetKey: null,
        occurredAt: "2026-03-15T09:30:19.000Z"
      },
      {
        id: "err_01HQKXR57YV8DA8S4MKKETG2S5",
        stage: "validation",
        code: "MISSING_SOURCE_FILENAME",
        message: "Source filename was missing for one or more legacy objects.",
        assetKey: "uploader/manual/legacy-import/object-07",
        occurredAt: "2026-03-15T09:30:49.000Z"
      }
    ],
    notes: [
      "This failed fixture run is intended to drive first-pass admin triage UI."
    ]
  }
];

import { json } from "../../../lib/http";

export async function previewMediaRoute(_key: string): Promise<Response> {
  return json(
    {
      error: {
        code: "LEGACY_MEDIA_ROUTE_DISABLED",
        message: "Use signed asset preview routes instead."
      }
    },
    410
  );
}

export async function originalMediaRoute(_key: string): Promise<Response> {
  return json(
    {
      error: {
        code: "ORIGINAL_ACCESS_RESTRICTED",
        message: "Original media access is not enabled yet"
      }
    },
    403
  );
}

export async function mediaAccessRoute(_key: string): Promise<Response> {
  return json(
    {
      error: {
        code: "LEGACY_MEDIA_ROUTE_DISABLED",
        message: "Use asset APIs with signed preview URLs instead."
      }
    },
    410
  );
}

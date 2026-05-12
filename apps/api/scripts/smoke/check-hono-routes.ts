import type { Env } from "../../src/appTypes";
import { honoApp } from "../../src/honoApp";

const TEST_INTERNAL_SECRET = "local-smoke-test-secret";
const BASE_URL = "https://api.local";
const forbiddenBodyPatterns = [
  /INTERNAL_API_SECRET/i,
  /x-internal-api-secret/i,
  /cloudflarestorage\.com/i,
  /X-Amz/i,
  /MEDIA_ORIGINALS_BUCKET/i,
  /MEDIA_PREVIEWS_BUCKET/i,
  /r2_original_key/i,
  /r2Original/i,
  /storageKey/i,
];

const env = {
  DATABASE_URL: undefined,
  INTERNAL_API_SECRET: TEST_INTERNAL_SECRET,
  MEDIA_PREVIEW_TOKEN_SECRET: "local-smoke-preview-token-secret",
  MEDIA_PREVIEW_TOKEN_TTL_SECONDS: "1800",
  MEDIA_PREVIEWS_BUCKET: {
    get: async () => null,
    head: async () => null,
  },
} as unknown as Env;

const checks: Array<{
  name: string;
  request: Request;
  expectedStatus: number;
  expectedCode?: string;
}> = [
  {
    name: "health route",
    request: request("/health"),
    expectedStatus: 200,
  },
  {
    name: "public catalog wrong method",
    request: request("/api/v1/assets", { method: "POST" }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "public catalog filters wrong method",
    request: request("/api/v1/assets/filters", { method: "POST" }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "public media preview wrong method",
    request: request("/api/v1/media/assets/local-asset/preview", { method: "POST" }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "auth profile wrong method",
    request: request("/api/v1/auth/me", { method: "POST" }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "internal account missing secret",
    request: request("/api/v1/internal/fotobox/items"),
    expectedStatus: 401,
    expectedCode: "INTERNAL_AUTH_REQUIRED",
  },
  {
    name: "internal admin missing secret",
    request: request("/api/v1/internal/admin/assets"),
    expectedStatus: 401,
    expectedCode: "INTERNAL_AUTH_REQUIRED",
  },
  {
    name: "internal account wrong method with secret",
    request: request("/api/v1/internal/fotobox/items", {
      method: "PUT",
      headers: internalHeaders(),
    }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "internal admin wrong method with secret",
    request: request("/api/v1/internal/admin/filters", {
      method: "POST",
      headers: internalHeaders(),
    }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "staff auth login wrong method",
    request: request("/api/v1/staff/auth/login", { method: "GET" }),
    expectedStatus: 405,
    expectedCode: "METHOD_NOT_ALLOWED",
  },
  {
    name: "legacy media preview disabled",
    request: request("/media/preview/fixtures/sample.jpg"),
    expectedStatus: 410,
    expectedCode: "LEGACY_MEDIA_ROUTE_DISABLED",
  },
  {
    name: "legacy original restricted",
    request: request("/media/original/fixtures/sample.jpg"),
    expectedStatus: 403,
    expectedCode: "ORIGINAL_ACCESS_RESTRICTED",
  },
  {
    name: "legacy fixture assets list",
    request: request("/assets"),
    expectedStatus: 200,
  },
  {
    name: "unknown route",
    request: request("/does-not-exist"),
    expectedStatus: 404,
    expectedCode: "ROUTE_NOT_FOUND",
  },
];

for (const check of checks) {
  const response = await honoApp.fetch(check.request, env);
  const bodyText = await response.text();
  assertStatus(check.name, response.status, check.expectedStatus, bodyText);
  assertNoForbiddenBody(check.name, bodyText);

  if (check.expectedCode) {
    assertErrorCode(check.name, bodyText, check.expectedCode);
  }

  console.log(`PASS ${check.name} (${response.status})`);
}

console.log("Hono route smoke checks passed.");

function request(pathname: string, init?: RequestInit): Request {
  return new Request(`${BASE_URL}${pathname}`, init);
}

function internalHeaders(): HeadersInit {
  return {
    "x-internal-api-secret": TEST_INTERNAL_SECRET,
  };
}

function assertStatus(name: string, actual: number, expected: number, bodyText: string): void {
  if (actual !== expected) {
    throw new Error(`${name}: expected status ${expected}, got ${actual}. Body: ${bodyText}`);
  }
}

function assertErrorCode(name: string, bodyText: string, expectedCode: string): void {
  const body = safeJson(bodyText);
  const actualCode = body?.error?.code ?? body?.code;
  if (actualCode !== expectedCode) {
    throw new Error(
      `${name}: expected error code ${expectedCode}, got ${String(actualCode)}. Body: ${bodyText}`,
    );
  }
}

function assertNoForbiddenBody(name: string, bodyText: string): void {
  for (const pattern of forbiddenBodyPatterns) {
    if (pattern.test(bodyText)) {
      throw new Error(`${name}: response body matched forbidden leak pattern ${pattern.source}`);
    }
  }
}

function safeJson(text: string): { error?: { code?: string }; code?: string } | null {
  try {
    return JSON.parse(text) as { error?: { code?: string }; code?: string };
  } catch {
    return null;
  }
}

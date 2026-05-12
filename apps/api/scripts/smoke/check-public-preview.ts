import { createHash, createHmac } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".dev.vars" });

const app = (await import("../../src/index")).default;

interface R2Config {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const env = {
  DATABASE_URL: requiredEnv("DATABASE_URL"),
  MEDIA_PREVIEW_TOKEN_SECRET: requiredEnv("MEDIA_PREVIEW_TOKEN_SECRET"),
  MEDIA_PREVIEW_TOKEN_TTL_SECONDS: process.env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS ?? "1800",
  MEDIA_PREVIEWS_BUCKET: {
    get: async (key: string) => {
      try {
        return await getR2Object(resolveR2Config(), key);
      } catch (error) {
        console.error(error instanceof Error ? error.message : "R2 GET failed.");
        throw error;
      }
    },
  },
};

const listResponse = await app.fetch(
  new Request("https://api.local/api/v1/assets?limit=1&sort=newest"),
  env,
);

if (listResponse.status !== 200) {
  throw new Error(`Expected public asset listing to return 200, got ${listResponse.status}`);
}

const listBody = await listResponse.json() as {
  items?: Array<{ previews?: { card?: { url?: string } | null } }>;
};
const previewUrl = listBody.items?.[0]?.previews?.card?.url;

if (!previewUrl) {
  throw new Error("Expected first public asset to include a signed card preview URL.");
}

const previewResponse = await app.fetch(new Request(`https://api.local${previewUrl}`), env);
const contentType = previewResponse.headers.get("content-type");

if (previewResponse.status !== 200) {
  const body = await previewResponse.text();
  throw new Error(`Expected preview to return 200, got ${previewResponse.status}: ${body}`);
}

if (contentType !== "image/webp") {
  throw new Error(`Expected preview content-type image/webp, got ${contentType ?? "missing"}`);
}

console.log("Public preview smoke check passed.");

async function getR2Object(config: R2Config, key: string) {
  const response = await signedR2Request(config, "GET", key);
  if (response.status === 404) return null;
  if (!response.ok || !response.body) {
    throw new Error(`R2 GET failed with ${response.status}`);
  }

  return {
    body: response.body,
    httpMetadata: {
      contentType: response.headers.get("content-type") ?? undefined,
    },
    httpEtag: response.headers.get("etag") ?? undefined,
    size: Number(response.headers.get("content-length") ?? 0),
    uploaded: parseHttpDate(response.headers.get("last-modified")),
  };
}

async function signedR2Request(config: R2Config, method: "GET", key: string) {
  const url = new URL(`${config.endpoint.replace(/\/+$/, "")}/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex("");
  const host = url.host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n");
  const signingKey = getSigningKey(config.secretAccessKey, dateStamp, config.region, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });
}

function resolveR2Config(): R2Config {
  const accountId = optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"]);
  const bucket = optionalEnv(["CLOUDFLARE_R2_PREVIEWS_BUCKET", "R2_PREVIEWS_BUCKET"]);
  const accessKeyId = optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"]);
  const secretAccessKey = optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"]);

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Preview R2 smoke check credentials are not configured.");
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: optionalEnv(["CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT"]) || `https://${accountId}.r2.cloudflarestorage.com`,
    region: optionalEnv(["CLOUDFLARE_R2_REGION", "R2_REGION"]) || "auto",
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getSigningKey(secret: string, date: string, region: string, service: string) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, service);
  return hmac(dateRegionServiceKey, "aws4_request");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function parseHttpDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

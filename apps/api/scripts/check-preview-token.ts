import assert from "node:assert/strict";
import {
  createPreviewToken,
  parseMediaPreviewVariant,
  verifyPreviewToken,
} from "../src/lib/media/preview-token";

const secret = "local-preview-token-test-secret";
const assetId = "018f6d8e-7a15-7b2e-8c0f-aef8d7aa0001";
const variant = parseMediaPreviewVariant("thumb");
const now = 1_900_000_000;

async function rejectsWithCode(
  action: () => Promise<unknown>,
  code: string,
) {
  await assert.rejects(action, (error) => {
    return error instanceof Error && "code" in error && error.code === code;
  });
}

const token = await createPreviewToken(
  { assetId, variant, expiresAt: now + 60 },
  secret,
);

const verified = await verifyPreviewToken(token, { assetId, variant }, secret, now);
assert.equal(verified.assetId, assetId);
assert.equal(verified.variant, variant);

const expiredToken = await createPreviewToken(
  { assetId, variant, expiresAt: now - 1 },
  secret,
);
await rejectsWithCode(
  () => verifyPreviewToken(expiredToken, { assetId, variant }, secret, now),
  "EXPIRED_PREVIEW_TOKEN",
);

await rejectsWithCode(
  () => verifyPreviewToken(token, { assetId, variant: "card" }, secret, now),
  "INVALID_PREVIEW_TOKEN",
);

await rejectsWithCode(
  () => verifyPreviewToken(token, { assetId: "018f6d8e-7a15-7b2e-8c0f-aef8d7aa0002", variant }, secret, now),
  "INVALID_PREVIEW_TOKEN",
);

assert.throws(
  () => parseMediaPreviewVariant("original"),
  (error) => error instanceof Error && "code" in error && error.code === "INVALID_VARIANT",
);

console.log("Preview token checks passed.");

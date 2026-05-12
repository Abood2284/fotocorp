import fs from "fs";
import path from "path";

const ROOT = path.join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "drizzle", ".wrangler"]);
const SKIP_FILES = new Set(["bulk-rename-contributor.mjs", "build-0022-snapshot.mjs"]);

/** Longest keys first */
const REPLACEMENTS = [
  ["created_by_photographer_account_id", "created_by_contributor_account_id"],
  ["created_by_photographer_id", "created_by_contributor_id"],
  ["photographer_upload_items", "contributor_upload_items"],
  ["photographer_upload_batches", "contributor_upload_batches"],
  ["photographer_sessions", "contributor_sessions"],
  ["photographer_accounts", "contributor_accounts"],
  ["photographer_account_id", "contributor_account_id"],
  ["photographer_id", "contributor_id"],
  ["photographers", "contributors"],
  ["/api/v1/photographer/", "/api/v1/contributor/"],
  ["admin-photographer-uploads", "admin-contributor-uploads"],
  ["internalAdminPhotographerUploadRoutes", "internalAdminContributorUploadRoutes"],
  ["internalAdminPhotographerUpload", "internalAdminContributorUpload"],
  ["PHOTOGRAPHER_SESSION_COOKIE", "CONTRIBUTOR_SESSION_COOKIE"],
  ["PHOTOGRAPHER_SESSION_TTL_SECONDS", "CONTRIBUTOR_SESSION_TTL_SECONDS"],
  ["PHOTOGRAPHER_AUTH_REQUIRED", "CONTRIBUTOR_AUTH_REQUIRED"],
  ["INVALID_PHOTOGRAPHER_CREDENTIALS", "INVALID_CONTRIBUTOR_CREDENTIALS"],
  ["PHOTOGRAPHER_API_NOT_CONFIGURED", "CONTRIBUTOR_API_NOT_CONFIGURED"],
  ["PHOTOGRAPHER_UPLOADS_BUCKET_NOT_CONFIGURED", "CONTRIBUTOR_UPLOADS_BUCKET_NOT_CONFIGURED"],
  ["PHOTOGRAPHER_UPLOAD_NOT_FOUND", "CONTRIBUTOR_UPLOAD_NOT_FOUND"],
  ["PHOTOGRAPHER_NOT_FOUND", "CONTRIBUTOR_NOT_FOUND"],
  ["PHOTOGRAPHER_APPROVAL", "CONTRIBUTOR_APPROVAL"],
  ["routes/photographer/", "routes/contributor/"],
  ["routes/internal/admin-photographer-uploads", "routes/internal/admin-contributor-uploads"],
  ["admin-photographer-uploads", "admin-contributor-uploads"],
  ["photographer-password", "contributor-password"],
  ["photographer-upload-storage-key", "contributor-upload-storage-key"],
  ["r2-photographer-uploads", "r2-contributor-uploads"],
  ["photographer-password-hash", "contributor-password-hash"],
];

function shouldProcess(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (rel.startsWith("..")) return false;
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (parts.includes("migrations-deprecated-from-web")) return false;
  const base = path.basename(absPath);
  if (SKIP_FILES.has(base)) return false;
  if (base === "legacy.ts" && rel.includes(`${path.sep}schema${path.sep}`)) return false;
  return /\.(ts|tsx|mts|cts|md|jsonc)$/.test(base);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(abs, out);
    } else out.push(abs);
  }
  return out;
}

let files = walk(ROOT);
for (const file of files) {
  if (!shouldProcess(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [a, b] of REPLACEMENTS) {
    if (!s.includes(a)) continue;
    s = s.split(a).join(b);
  }
  if (s !== orig) fs.writeFileSync(file, s);
}
console.log("bulk replace done");

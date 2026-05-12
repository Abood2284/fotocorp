import fs from "fs";
import path from "path";

const ROOT = path.join(import.meta.dirname, "../src");

const REPLACEMENTS = [
  ["admin-photographer-uploads-client", "admin-contributor-uploads-client"],
  ["admin-photographer-uploads-api", "admin-contributor-uploads-api"],
  ["admin/photographer-uploads", "admin/contributor-uploads"],
  ["adminPhotographerUploads", "adminContributorUploads"],
  ["/api/photographer/", "/api/contributor/"],
  ["/photographer/", "/contributor/"],
  ["\"/photographer\"", "\"/contributor\""],
  ["'/photographer'", "'/contributor'"],
  ["(marketing)/photographer", "(contributor)/contributor"],
  ["photographer-api", "contributor-api"],
  ["photographer-session", "contributor-session"],
  ["PhotographerApiError", "ContributorApiError"],
  ["PhotographerApi", "ContributorApi"],
  ["photographerShell", "contributorShell"],
  ["PhotographerShell", "ContributorShell"],
  ["requirePhotographerPortalSession", "requireContributorPortalSession"],
  ["PHOTOGRAPHER_API_NOT_CONFIGURED", "CONTRIBUTOR_API_NOT_CONFIGURED"],
  ["catalog/photographers", "catalog/contributors"],
  ["/admin/catalog/photographers", "/admin/catalog/contributors"],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, out);
    else if (/\.(tsx?|md)$/.test(ent.name)) out.push(abs);
  }
  return out;
}

for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [a, b] of REPLACEMENTS) {
    if (!s.includes(a)) continue;
    s = s.split(a).join(b);
  }
  if (s !== orig) fs.writeFileSync(file, s);
}
console.log("web bulk rename done");

import fs from "fs";
import crypto from "crypto";

const j = JSON.parse(fs.readFileSync("drizzle/meta/0021_snapshot.json", "utf8"));
j.prevId = j.id;
j.id = crypto.randomUUID();
const tables = j.tables;

function rekey(oldK, newK) {
  const t = tables[oldK];
  if (!t) throw new Error(`missing ${oldK}`);
  t.name = newK.replace("public.", "");
  delete tables[oldK];
  tables[newK] = t;
}

rekey("public.photographer_upload_items", "public.contributor_upload_items");
rekey("public.photographer_upload_batches", "public.contributor_upload_batches");
rekey("public.photographer_sessions", "public.contributor_sessions");
rekey("public.photographer_accounts", "public.contributor_accounts");
rekey("public.photographers", "public.contributors");

function mvCol(tbl, from, to) {
  const cols = tbl.columns;
  if (!cols[from]) return;
  cols[to] = { ...cols[from], name: to };
  delete cols[from];
}

const pe = tables["public.photo_events"];
mvCol(pe, "created_by_photographer_id", "created_by_contributor_id");
mvCol(pe, "created_by_photographer_account_id", "created_by_contributor_account_id");
pe.checkConstraints["photo_events_source_check"].value =
  '"photo_events"."source" in (\'LEGACY_IMPORT\', \'MANUAL\', \'CONTRIBUTOR\')';
pe.checkConstraints["photo_events_created_by_source_check"].value =
  '"photo_events"."created_by_source" in (\'LEGACY_IMPORT\', \'ADMIN\', \'CONTRIBUTOR\', \'SYSTEM\')';

const ia = tables["public.image_assets"];
mvCol(ia, "photographer_id", "contributor_id");
ia.checkConstraints["image_assets_source_check"].value =
  '"image_assets"."source" in (\'LEGACY_IMPORT\', \'MANUAL\', \'CONTRIBUTOR_UPLOAD\', \'FOTOCORP\')';

tables["public.app_user_profiles"].checkConstraints["app_user_profiles_role_check"].value =
  '"app_user_profiles"."role" in (\'USER\', \'CONTRIBUTOR\', \'ADMIN\', \'SUPER_ADMIN\')';

tables["public.image_publish_jobs"].columns.job_type.default = "'CONTRIBUTOR_APPROVAL'";

const cubs = tables["public.contributor_upload_batches"];
mvCol(cubs, "photographer_id", "contributor_id");
mvCol(cubs, "photographer_account_id", "contributor_account_id");

const cuis = tables["public.contributor_upload_items"];
mvCol(cuis, "photographer_id", "contributor_id");
mvCol(cuis, "photographer_account_id", "contributor_account_id");

const cas = tables["public.contributor_accounts"];
mvCol(cas, "photographer_id", "contributor_id");

const cs = tables["public.contributor_sessions"];
mvCol(cs, "photographer_account_id", "contributor_account_id");
mvCol(cs, "photographer_id", "contributor_id");

const cont = tables["public.contributors"];
for (const [a, b] of [
  ["photographers_legacy_photographer_id_unique_idx", "contributors_legacy_photographer_id_unique_idx"],
  ["photographers_status_idx", "contributors_status_idx"],
  ["photographers_display_name_lower_idx", "contributors_display_name_lower_idx"],
  ["photographers_email_lower_idx", "contributors_email_lower_idx"],
  ["photographers_source_idx", "contributors_source_idx"],
  ["photographers_legacy_photographer_id_unique", "contributors_legacy_photographer_id_unique"],
  ["photographers_status_check", "contributors_status_check"],
  ["photographers_source_check", "contributors_source_check"],
]) {
  if (cont.indexes?.[a]) {
    cont.indexes[b] = { ...cont.indexes[a], name: b };
    delete cont.indexes[a];
  }
  if (cont.uniqueConstraints?.[a]) {
    cont.uniqueConstraints[b] = { ...cont.uniqueConstraints[a], name: b };
    delete cont.uniqueConstraints[a];
  }
  if (cont.checkConstraints?.[a]) {
    cont.checkConstraints[b] = { ...cont.checkConstraints[a], name: b };
    delete cont.checkConstraints[a];
  }
}
if (cont.indexes["contributors_legacy_photographer_id_unique_idx"]) {
  cont.indexes["contributors_legacy_photographer_id_unique_idx"].where =
    '"contributors"."legacy_photographer_id" is not null';
}
if (cont.indexes["contributors_email_lower_idx"]) {
  cont.indexes["contributors_email_lower_idx"].where = '"contributors"."email" is not null';
}
if (cont.checkConstraints["contributors_status_check"]) {
  cont.checkConstraints["contributors_status_check"].value =
    '"contributors"."status" in (\'ACTIVE\', \'INACTIVE\', \'DELETED\', \'UNKNOWN\')';
}
if (cont.checkConstraints["contributors_source_check"]) {
  cont.checkConstraints["contributors_source_check"].value =
    '"contributors"."source" in (\'LEGACY_IMPORT\', \'MANUAL\')';
}

const ca = tables["public.contributor_accounts"];
for (const [a, b] of [
  ["photographer_accounts_username_lower_uidx", "contributor_accounts_username_lower_uidx"],
  ["photographer_accounts_photographer_id_uidx", "contributor_accounts_contributor_id_uidx"],
  ["photographer_accounts_status_idx", "contributor_accounts_status_idx"],
  ["photographer_accounts_created_at_idx", "contributor_accounts_created_at_idx"],
  ["photographer_accounts_status_check", "contributor_accounts_status_check"],
  [
    "photographer_accounts_photographer_id_photographers_id_fk",
    "contributor_accounts_contributor_id_contributors_id_fk",
  ],
]) {
  if (ca.indexes?.[a]) {
    ca.indexes[b] = { ...ca.indexes[a], name: b };
    delete ca.indexes[a];
  }
  if (ca.checkConstraints?.[a]) {
    ca.checkConstraints[b] = { ...ca.checkConstraints[a], name: b };
    delete ca.checkConstraints[a];
  }
  if (ca.foreignKeys?.[a]) {
    const fk = { ...ca.foreignKeys[a], name: b, tableFrom: "contributor_accounts", tableTo: "contributors" };
    fk.columnsFrom = ["contributor_id"];
    ca.foreignKeys[b] = fk;
    delete ca.foreignKeys[a];
  }
}
if (ca.indexes["contributor_accounts_contributor_id_uidx"]) {
  ca.indexes["contributor_accounts_contributor_id_uidx"].columns[0].expression = "contributor_id";
}
if (ca.checkConstraints["contributor_accounts_status_check"]) {
  ca.checkConstraints["contributor_accounts_status_check"].value =
    '"contributor_accounts"."status" in (\'ACTIVE\', \'DISABLED\', \'LOCKED\')';
}

const sess = tables["public.contributor_sessions"];
for (const [a, b] of [
  ["photographer_sessions_token_hash_uidx", "contributor_sessions_token_hash_uidx"],
  ["photographer_sessions_account_id_idx", "contributor_sessions_account_id_idx"],
  ["photographer_sessions_photographer_id_idx", "contributor_sessions_contributor_id_idx"],
  ["photographer_sessions_expires_at_idx", "contributor_sessions_expires_at_idx"],
  ["photographer_sessions_active_idx", "contributor_sessions_active_idx"],
  ["photographer_sessions_token_hash_unique", "contributor_sessions_token_hash_unique"],
  [
    "photographer_sessions_photographer_account_id_photographer_accounts_id_fk",
    "contributor_sessions_contributor_account_id_contributor_accounts_id_fk",
  ],
  [
    "photographer_sessions_photographer_id_photographers_id_fk",
    "contributor_sessions_contributor_id_contributors_id_fk",
  ],
]) {
  if (sess.indexes?.[a]) {
    sess.indexes[b] = { ...sess.indexes[a], name: b };
    delete sess.indexes[a];
  }
  if (sess.uniqueConstraints?.[a]) {
    sess.uniqueConstraints[b] = { ...sess.uniqueConstraints[a], name: b };
    delete sess.uniqueConstraints[a];
  }
  if (sess.foreignKeys?.[a]) {
    const fk = { ...sess.foreignKeys[a], name: b, tableFrom: "contributor_sessions" };
    if (a.includes("account")) {
      fk.tableTo = "contributor_accounts";
      fk.columnsFrom = ["contributor_account_id"];
    } else {
      fk.tableTo = "contributors";
      fk.columnsFrom = ["contributor_id"];
    }
    sess.foreignKeys[b] = fk;
    delete sess.foreignKeys[a];
  }
}
if (sess.indexes["contributor_sessions_contributor_id_idx"]) {
  sess.indexes["contributor_sessions_contributor_id_idx"].columns[0].expression = "contributor_id";
}
if (sess.indexes["contributor_sessions_account_id_idx"]) {
  sess.indexes["contributor_sessions_account_id_idx"].columns[0].expression = "contributor_account_id";
}
if (sess.indexes["contributor_sessions_active_idx"]) {
  sess.indexes["contributor_sessions_active_idx"].where = '"contributor_sessions"."revoked_at" is null';
  sess.indexes["contributor_sessions_active_idx"].columns[0].expression = "contributor_account_id";
}

const batches = tables["public.contributor_upload_batches"];
for (const [a, b] of [
  ["photographer_upload_batches_photographer_id_idx", "contributor_upload_batches_contributor_id_idx"],
  ["photographer_upload_batches_account_id_idx", "contributor_upload_batches_account_id_idx"],
  ["photographer_upload_batches_event_id_idx", "contributor_upload_batches_event_id_idx"],
  ["photographer_upload_batches_status_idx", "contributor_upload_batches_status_idx"],
  ["photographer_upload_batches_created_at_idx", "contributor_upload_batches_created_at_idx"],
  ["photographer_upload_batches_status_check", "contributor_upload_batches_status_check"],
  [
    "photographer_upload_batches_photographer_id_photographers_id_fk",
    "contributor_upload_batches_contributor_id_contributors_id_fk",
  ],
  [
    "photographer_upload_batches_photographer_account_id_photographer_accounts_id_fk",
    "contributor_upload_batches_contributor_account_id_contributor_accounts_id_fk",
  ],
  [
    "photographer_upload_batches_event_id_photo_events_id_fk",
    "contributor_upload_batches_event_id_photo_events_id_fk",
  ],
]) {
  if (batches.indexes?.[a]) {
    batches.indexes[b] = { ...batches.indexes[a], name: b };
    delete batches.indexes[a];
  }
  if (batches.checkConstraints?.[a]) {
    batches.checkConstraints[b] = { ...batches.checkConstraints[a], name: b };
    delete batches.checkConstraints[a];
  }
  if (batches.foreignKeys?.[a]) {
    const fk = { ...batches.foreignKeys[a], name: b, tableFrom: "contributor_upload_batches" };
    if (a.includes("event_id_photo")) fk.tableTo = "photo_events";
    else if (a.includes("photographer_account")) {
      fk.tableTo = "contributor_accounts";
      fk.columnsFrom = ["contributor_account_id"];
    } else {
      fk.tableTo = "contributors";
      fk.columnsFrom = ["contributor_id"];
    }
    batches.foreignKeys[b] = fk;
    delete batches.foreignKeys[a];
  }
}
if (batches.indexes["contributor_upload_batches_contributor_id_idx"]) {
  batches.indexes["contributor_upload_batches_contributor_id_idx"].columns[0].expression = "contributor_id";
}
if (batches.indexes["contributor_upload_batches_account_id_idx"]) {
  batches.indexes["contributor_upload_batches_account_id_idx"].columns[0].expression = "contributor_account_id";
}
if (batches.checkConstraints["contributor_upload_batches_status_check"]) {
  batches.checkConstraints["contributor_upload_batches_status_check"].value =
    '"contributor_upload_batches"."status" in (\'OPEN\', \'SUBMITTED\', \'COMPLETED\', \'FAILED\', \'CANCELLED\')';
}

const items = tables["public.contributor_upload_items"];
for (const [a, b] of [
  ["photographer_upload_items_storage_key_uidx", "contributor_upload_items_storage_key_uidx"],
  ["photographer_upload_items_batch_id_idx", "contributor_upload_items_batch_id_idx"],
  ["photographer_upload_items_photographer_id_idx", "contributor_upload_items_contributor_id_idx"],
  ["photographer_upload_items_account_id_idx", "contributor_upload_items_account_id_idx"],
  ["photographer_upload_items_image_asset_id_idx", "contributor_upload_items_image_asset_id_idx"],
  ["photographer_upload_items_upload_status_idx", "contributor_upload_items_upload_status_idx"],
  ["photographer_upload_items_status_check", "contributor_upload_items_status_check"],
  [
    "photographer_upload_items_batch_id_photographer_upload_batches_id_fk",
    "contributor_upload_items_batch_id_contributor_upload_batches_id_fk",
  ],
  [
    "photographer_upload_items_photographer_id_photographers_id_fk",
    "contributor_upload_items_contributor_id_contributors_id_fk",
  ],
  [
    "photographer_upload_items_photographer_account_id_photographer_accounts_id_fk",
    "contributor_upload_items_contributor_account_id_contributor_accounts_id_fk",
  ],
  [
    "photographer_upload_items_image_asset_id_image_assets_id_fk",
    "contributor_upload_items_image_asset_id_image_assets_id_fk",
  ],
]) {
  if (items.indexes?.[a]) {
    items.indexes[b] = { ...items.indexes[a], name: b };
    delete items.indexes[a];
  }
  if (items.checkConstraints?.[a]) {
    items.checkConstraints[b] = { ...items.checkConstraints[a], name: b };
    delete items.checkConstraints[a];
  }
  if (items.foreignKeys?.[a]) {
    const fk = { ...items.foreignKeys[a], name: b, tableFrom: "contributor_upload_items" };
    if (a.includes("batches")) fk.tableTo = "contributor_upload_batches";
    else if (a.includes("photographer_account")) {
      fk.tableTo = "contributor_accounts";
      fk.columnsFrom = ["contributor_account_id"];
    } else if (a.includes("photographers")) {
      fk.tableTo = "contributors";
      fk.columnsFrom = ["contributor_id"];
    } else if (a.includes("image_assets")) fk.tableTo = "image_assets";
    items.foreignKeys[b] = fk;
    delete items.foreignKeys[a];
  }
}
if (items.checkConstraints["contributor_upload_items_status_check"]) {
  items.checkConstraints["contributor_upload_items_status_check"].value =
    '"contributor_upload_items"."upload_status" in (\'PENDING\', \'UPLOADED\', \'ASSET_CREATED\', \'FAILED\')';
}
if (items.indexes["contributor_upload_items_contributor_id_idx"]) {
  items.indexes["contributor_upload_items_contributor_id_idx"].columns[0].expression = "contributor_id";
}
if (items.indexes["contributor_upload_items_account_id_idx"]) {
  items.indexes["contributor_upload_items_account_id_idx"].columns[0].expression = "contributor_account_id";
}

for (const [a, b] of [
  ["photo_events_created_by_photographer_id_idx", "photo_events_created_by_contributor_id_idx"],
  ["photo_events_created_by_photographer_account_id_idx", "photo_events_created_by_contributor_account_id_idx"],
]) {
  if (!pe.indexes[a]) continue;
  pe.indexes[b] = { ...pe.indexes[a], name: b };
  for (const col of pe.indexes[b].columns) {
    if (col.expression === "created_by_photographer_id") col.expression = "created_by_contributor_id";
    if (col.expression === "created_by_photographer_account_id")
      col.expression = "created_by_contributor_account_id";
  }
  delete pe.indexes[a];
}

for (const [a, b] of [
  [
    "photo_events_created_by_photographer_id_photographers_id_fk",
    "photo_events_created_by_contributor_id_contributors_id_fk",
  ],
  [
    "photo_events_created_by_photographer_account_id_photographer_accounts_id_fk",
    "photo_events_created_by_contributor_account_id_contributor_accounts_id_fk",
  ],
]) {
  if (!pe.foreignKeys[a]) continue;
  const fk = { ...pe.foreignKeys[a], name: b, tableFrom: "photo_events" };
  fk.tableTo = a.includes("accounts") ? "contributor_accounts" : "contributors";
  fk.columnsFrom = a.includes("accounts") ? ["created_by_contributor_account_id"] : ["created_by_contributor_id"];
  pe.foreignKeys[b] = fk;
  delete pe.foreignKeys[a];
}

if (ia.indexes["image_assets_photographer_id_idx"]) {
  ia.indexes["image_assets_contributor_id_idx"] = { ...ia.indexes["image_assets_photographer_id_idx"], name: "image_assets_contributor_id_idx" };
  ia.indexes["image_assets_contributor_id_idx"].columns[0].expression = "contributor_id";
  delete ia.indexes["image_assets_photographer_id_idx"];
}
if (ia.foreignKeys["image_assets_photographer_id_photographers_id_fk"]) {
  ia.foreignKeys["image_assets_contributor_id_contributors_id_fk"] = {
    ...ia.foreignKeys["image_assets_photographer_id_photographers_id_fk"],
    name: "image_assets_contributor_id_contributors_id_fk",
    tableFrom: "image_assets",
    tableTo: "contributors",
    columnsFrom: ["contributor_id"],
    columnsTo: ["id"],
  };
  delete ia.foreignKeys["image_assets_photographer_id_photographers_id_fk"];
}

fs.writeFileSync("drizzle/meta/0022_snapshot.json", JSON.stringify(j, null, 2));
console.log("wrote drizzle/meta/0022_snapshot.json");

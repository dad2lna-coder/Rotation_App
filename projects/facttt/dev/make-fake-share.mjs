#!/usr/bin/env node
/**
 * Scaffold a LOCAL FAKE FACTTT share for dev/testing.
 *
 * OneDrive is NOT present in this environment — it is the reference target for
 * the final product. This script stands in for it so we can exercise the
 * create-if-missing rules from rotation_app/src-tauri/src/paths.rs without a
 * Windows box.
 *
 * Mirrors paths.rs exactly:
 *   - root discovery concept (here: explicit --root)
 *   - ensure_share_layout_at(): data/, inbox/, archive/, data/dashboard.json
 *   - starter_dashboard() shape + schema name
 *   - write_submit_at(): submit-<iso_ts_file>-<safe_operator>.json  (dashboard untouched)
 *
 * Usage:
 *   node make-fake-share.mjs                     # scaffold default fake root
 *   node make-fake-share.mjs --root /tmp/x/FACTTT
 *   node make-fake-share.mjs --submit JMoore     # also drop a sample inbox submit
 *   node make-fake-share.mjs --reset             # wipe then scaffold
 */
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(HERE, "fake-share", "FACTTT");

const APP_TITLE = "Let Them Cook";
const SCHEMA = "let-them-cook-dashboard";

// --- args ---------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}
const rootArg = flag("--root");
const submitArg = flag("--submit");
const reset = argv.includes("--reset");

const root = typeof rootArg === "string" ? path.resolve(rootArg) : DEFAULT_ROOT;

// --- helpers mirroring paths.rs ----------------------------------------
const dataDir = (r) => path.join(r, "data");
const inboxDir = (r) => path.join(r, "inbox");
const archiveDir = (r) => path.join(r, "archive");
const dashboardPath = (r) => path.join(dataDir(r), "dashboard.json");

/** paths.rs safe_operator(): [A-Za-z0-9_-] kept, rest -> _, trim _, max 40. */
export function safeOperator(name) {
  const mapped = String(name).replace(/[^A-Za-z0-9_-]/g, "_");
  const trimmed = mapped.replace(/^_+|_+$/g, "");
  const slice = trimmed.slice(0, 40);
  return slice.length ? slice : "OPERATOR";
}

/** paths.rs iso_ts_file(): 2026-09-18T16-02-05Z */
export function isoTsFile(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}Z`
  );
}

/** paths.rs starter_dashboard() */
export function starterDashboard() {
  return {
    version: 1,
    updatedAt: null,
    updatedBy: null,
    items: [],
    sharedNotes: "",
    meta: { app: APP_TITLE },
    schema: SCHEMA,
    schemaVersion: "2.0.0",
    exportedAt: null,
    exportedBy: null,
    source: "LetThemCook.exe",
    intendedFolderDisplayName: "OneDrive - USTSA\\FACTTT",
    goals: [],
    objectives: [],
    movements: {
      ndo: { label: "NDO Movement", flow: null, ideas: [], actions: [], questions: [] },
      training: { label: "Training Movement", flow: null, ideas: [], actions: [], questions: [] },
      tsst: { label: "TSST-Travel", flow: null, ideas: [], actions: [], questions: [] },
    },
  };
}

/** paths.rs ensure_share_layout_at(): create dirs + starter dashboard if absent. */
export function ensureShareLayout(r) {
  for (const dir of [dataDir(r), inboxDir(r), archiveDir(r)]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const dash = dashboardPath(r);
  let created = false;
  if (!fs.existsSync(dash)) {
    fs.writeFileSync(dash, JSON.stringify(starterDashboard(), null, 2) + "\n", "utf8");
    created = true;
  }
  return { root: r, dashboardCreated: created, dashboard: dash };
}

/** paths.rs write_submit_at(): writes inbox submit; never touches dashboard.json. */
export function writeSubmit(r, payload, operator = "OPERATOR") {
  ensureShareLayout(r);
  const op = safeOperator(operator);
  const file = `submit-${isoTsFile()}-${op}.json`;
  const dest = path.join(inboxDir(r), file);
  fs.writeFileSync(dest, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return dest;
}

// --- run ----------------------------------------------------------------
function main() {
  if (reset && fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
    console.log("reset: removed", root);
  }
  if (root.toLowerCase().includes("onedrive")) {
    console.error("refusing to scaffold a path that looks like real OneDrive:", root);
    process.exit(1);
  }

  const before = fs.existsSync(dashboardPath(root))
    ? fs.readFileSync(dashboardPath(root), "utf8")
    : null;

  const res = ensureShareLayout(root);
  console.log("fake FACTTT root:", res.root);
  console.log("data/    ->", dataDir(root));
  console.log("inbox/   ->", inboxDir(root));
  console.log("archive/ ->", archiveDir(root));
  console.log("dashboard.json:", res.dashboardCreated ? "created (starter)" : "kept (already present)");

  if (typeof submitArg === "string") {
    const sample = {
      ...starterDashboard(),
      updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      updatedBy: submitArg,
      sharedNotes: "Sample submit from make-fake-share.mjs — Power Automate would merge this then archive it.",
      exportedBy: submitArg,
      exportedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      source: "make-fake-share.mjs",
    };
    const dest = writeSubmit(root, sample, submitArg);
    console.log("submit  ->", dest);

    const after = fs.readFileSync(dashboardPath(root), "utf8");
    if (before !== null && before !== after) {
      console.error("FAIL: dashboard.json changed while writing a submit");
      process.exit(1);
    }
    console.log("check   -> dashboard.json untouched by submit ✓");
  }

  console.log("done. Point FACTTT_ROOT at:", root);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

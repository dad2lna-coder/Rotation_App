#!/usr/bin/env node
const { mkdirSync, copyFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = join(__dirname, "..");
const apply = spawnSync(process.execPath, [join(__dirname, "apply-ui-init-fix.js")], {
  cwd: root,
  stdio: "inherit",
});
if (apply.status !== 0) {
  process.exit(apply.status || 1);
}

const www = join(root, "www");
mkdirSync(www, { recursive: true });
copyFileSync(join(root, "index.html"), join(www, "index.html"));
console.log("www/index.html synced from index.html");

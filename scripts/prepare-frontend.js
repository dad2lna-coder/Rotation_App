#!/usr/bin/env node
const { mkdirSync, copyFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const www = join(root, "www");
mkdirSync(www, { recursive: true });
copyFileSync(join(root, "index.html"), join(www, "index.html"));
console.log("www/index.html synced from index.html");

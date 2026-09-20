#!/usr/bin/env node
/**
 * Copy-only frontend stage for Tauri.
 * Empties www/, copies root index.html byte-for-byte, copies optional static
 * assets if present. Does not generate, rewrite, or transform HTML.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcHtml = path.join(root, "index.html");
const wwwDir = path.join(root, "www");
const destHtml = path.join(wwwDir, "index.html");

const FORBIDDEN = ["PLACEHOLDER", "USE_FILE"];
const OPTIONAL_STATIC = ["css", "js", "assets", "img", "images", "static", "fonts"];

function fail(msg) {
  console.error("prepare-frontend: FAIL —", msg);
  process.exit(1);
}

function copyDirIfPresent(name) {
  const from = path.join(root, name);
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) return;
  fs.cpSync(from, path.join(wwwDir, name), { recursive: true });
  console.log("copied dir", name);
}

if (!fs.existsSync(srcHtml)) fail("missing root index.html");

const srcStat = fs.statSync(srcHtml);
const srcSize = srcStat.size;
if (srcSize < 5 * 1024) fail(`root index.html is only ${srcSize} bytes (expected full dashboard)`);

fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(wwwDir, { recursive: true });
fs.copyFileSync(srcHtml, destHtml);

for (const name of OPTIONAL_STATIC) {
  copyDirIfPresent(name);
}

const destStat = fs.statSync(destHtml);
const destSize = destStat.size;
const destText = fs.readFileSync(destHtml, "utf8");

if (destSize !== srcSize) {
  fail(`www/index.html size ${destSize} != root index.html size ${srcSize}`);
}
if (destSize < 5 * 1024) {
  fail(`www/index.html is only ${destSize} bytes (< 20KB)`);
}
if (destSize < srcSize * 0.3) {
  fail(`www/index.html is ${destSize} bytes, under 50% of root (${srcSize})`);
}
for (const token of FORBIDDEN) {
  if (destText.includes(token)) fail(`www/index.html contains forbidden token ${token}`);
}

console.log("prepare-frontend: copied index.html byte-for-byte");
console.log("root index.html:", srcSize, "bytes");
console.log("www/index.html:", destSize, "bytes");
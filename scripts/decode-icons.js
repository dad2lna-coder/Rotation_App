/**
 * Writes src-tauri/icons from scripts/icons-b64.json.
 * Run before `tauri build` if the PNGs/ICO are not already present.
 */
const { mkdirSync, writeFileSync, readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const jsonPath = join(root, "scripts", "icons-b64.json");
const outDir = join(root, "src-tauri", "icons");

if (!existsSync(jsonPath)) {
  if (existsSync(join(outDir, "icon.ico"))) {
    console.log("icons already present");
    process.exit(0);
  }
  console.error("missing scripts/icons-b64.json");
  process.exit(1);
}

const icons = JSON.parse(readFileSync(jsonPath, "utf8"));
mkdirSync(outDir, { recursive: true });
for (const [name, b64] of Object.entries(icons)) {
  const dest = join(outDir, name);
  writeFileSync(dest, Buffer.from(b64, "base64"));
  console.log("wrote", dest);
}
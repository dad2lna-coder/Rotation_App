#!/usr/bin/env node
const { execSync } = require("node:child_process");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const indexPath = join(root, "index.html");
const BASE_COMMIT = "9b2e96004c7cc4634c823667d9b8b0af8991b6ff";

function restoreBaseIfNeeded(text) {
  const looksComplete =
    text.includes("Operational Movements Discovery Dashboard") &&
    text.includes("function saveToInbox") &&
    text.includes("async function bootShare") &&
    text.length > 20000;
  if (looksComplete) {
    return text;
  }
  console.log("index.html is incomplete; restoring dashboard from", BASE_COMMIT);
  return execSync("git show " + BASE_COMMIT + ":index.html", {
    cwd: root,
    encoding: "utf8",
  });
}

function addButtonTypeAttribute(html) {
  return html.replace(/<button\b([^>]*)>/g, (full, attrs) => {
    if (/\btype\s*=/.test(attrs)) {
      return full;
    }
    return "<button type=\"button\"" + attrs + ">";
  });
}

function applyFix(text) {
  let next = text;

  const toolbarOld = "        <button class=\"success\" id=\"refresh-btn\" onclick=\"refreshFromShare()\">Refresh</button>\n        <button id=\"save-btn\" onclick=\"saveToInbox()\">Save</button>\n        <button onclick=\"window.print()\">Print / Save as PDF</button>\n        <button class=\"light\" onclick=\"toggleMoreActions()\">More</button>\n        <button class=\"warning\" onclick=\"resetDashboard()\">Reset local cache</button>";
  const toolbarNew = "        <button type=\"button\" class=\"success\" id=\"refresh-btn\" data-action=\"refresh\">Refresh</button>\n        <button type=\"button\" id=\"save-btn\" data-action=\"save\">Save</button>\n        <button type=\"button\" data-action=\"print\">Print / Save as PDF</button>\n        <button type=\"button\" class=\"light\" data-action=\"toggle-more\">More</button>\n        <button type=\"button\" class=\"warning\" data-action=\"reset\">Reset local cache</button>";
  if (next.includes(toolbarOld)) {
    next = next.replace(toolbarOld, toolbarNew);
  }

  next = addButtonTypeAttribute(next);

  const helpersOld = "    function isTauri() {\n      return Boolean(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);\n    }\n\n    function invokeCommand(name, args) {\n      return window.__TAURI__.core.invoke(name, args || {});\n    }";
  const helpersNew = "    function getTauriInvoke() {\n      const invoke = window.__TAURI__?.core?.invoke;\n      if (typeof invoke !== \"function\") {\n        throw new Error(\"Tauri invoke API is unavailable.\");\n      }\n      return invoke;\n    }\n\n    function isTauri() {\n      return typeof window.__TAURI__?.core?.invoke === \"function\";\n    }\n\n    async function invokeCommand(name, args = {}) {\n      const invoke = getTauriInvoke();\n      try {\n        return await invoke(name, args);\n      } catch (error) {\n        console.error(\"Tauri command failed: \" + name, error);\n        throw error;\n      }\n    }";
  if (next.includes(helpersOld)) {
    next = next.replace(helpersOld, helpersNew);
  }

  const bootOld = "    async function bootShare() {\n      document.querySelectorAll(\"button\").forEach((btn) => {\n        if (!btn.getAttribute(\"type\")) btn.setAttribute(\"type\", \"button\");\n      });\n      decorateEditableList(\"goals-list\");\n      decorateEditableList(\"objectives-list\");\n      const banner = document.getElementById(\"preview-banner\");\n";
  const bootNew = "    async function bootShare() {\n      const banner = document.getElementById(\"preview-banner\");\n";
  if (next.includes(bootOld)) {
    next = next.replace(bootOld, bootNew);
  }

  const endOld = "    window.addEventListener(\"load\", bootShare);\n  </script>";
  const endNew = [
    "    function bindUiEvents() {",
    "      if (document.body.dataset.eventsBound === \"true\") {",
    "        return;",
    "      }",
    "      document.body.dataset.eventsBound = \"true\";",
    "      document.addEventListener(\"click\", event => {",
    "        const target = event.target.closest(\"[data-action]\");",
    "        if (!target) {",
    "          return;",
    "        }",
    "        const action = target.dataset.action;",
    "        switch (action) {",
    "          case \"refresh\":",
    "            refreshFromShare();",
    "            break;",
    "          case \"save\":",
    "            saveToInbox();",
    "            break;",
    "          case \"print\":",
    "            window.print();",
    "            break;",
    "          case \"toggle-more\":",
    "            toggleMoreActions();",
    "            break;",
    "          case \"reset\":",
    "            resetDashboard();",
    "            break;",
    "          default:",
    "            console.warn(\"Unknown UI action:\", action);",
    "        }",
    "      });",
    "    }",
    "",
    "    function initializeUi() {",
    "      bindUiEvents();",
    "      decorateEditableList(\"goals-list\");",
    "      decorateEditableList(\"objectives-list\");",
    "      updateMetrics();",
    "      bootShare().catch(error => {",
    "        console.error(\"Share initialization failed:\", error);",
    "        showToast(",
    "          \"Shared-folder initialization failed. The dashboard remains editable.\",",
    "          \"err\"",
    "        );",
    "      });",
    "    }",
    "",
    "    window.addEventListener(\"error\", event => {",
    "      console.error(",
    "        \"Unhandled application error:\",",
    "        event.error || event.message",
    "      );",
    "      showToast(",
    "        \"Application error: \" +",
    "          (event.message || \"Unknown JavaScript error\"),",
    "        \"err\"",
    "      );",
    "    });",
    "    window.addEventListener(\"unhandledrejection\", event => {",
    "      console.error(",
    "        \"Unhandled promise rejection:\",",
    "        event.reason",
    "      );",
    "      showToast(",
    "        \"Application operation failed. See the console for details.\",",
    "        \"err\"",
    "      );",
    "    });",
    "",
    "    window.addEventListener(\"DOMContentLoaded\", () => {",
    "      initializeUi();",
    "    });",
    "  </script>"
  ].join("\n");
  if (next.includes(endOld)) {
    next = next.replace(endOld, endNew);
  }

  return next;
}

function main() {
  const current = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  const base = restoreBaseIfNeeded(current);
  const fixed = applyFix(base);
  if (!fixed.includes("function initializeUi")) {
    throw new Error("UI init fix was not applied; initializeUi() is missing.");
  }
  if (!fixed.includes("function getTauriInvoke")) {
    throw new Error("UI init fix was not applied; getTauriInvoke() is missing.");
  }
  writeFileSync(indexPath, fixed);
  console.log("Applied UI initialization fix to index.html");
}

main();

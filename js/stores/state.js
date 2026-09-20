// State management for Let Them Cook initiative tracker
import { escapeHtml, normalizeText } from "../utils/strings.js";
import { getTauriInvoke, isTauri, invokeCommand } from "../utils/tauri.js";
import { showToast, toggleMoreActions } from "../utils/ui.js";
import { collectSectionPayload } from "../data/store.js";
import { EMPTY_PAYLOAD } from "../data/schema.js";

export const STORAGE_KEY = "let_them_cook_initiatives_facttt_v2";
export const DEMO_DASHBOARD_KEY = "ltc_preview_initiatives_json";
export const JSON_FOLDER_DISPLAY_NAME = "OneDrive - USTSA\\FACTTT";
export const APP_TITLE = "Let Them Cook";

let currentOperator = "";
let sharePath = "";
let toastTimer = null;
let currentInitiativeId = null;
let currentPayload = null;

export { escapeHtml, normalizeText };
export { showToast, toggleMoreActions };
export { EMPTY_PAYLOAD };

export function setCurrentPayload(payload) {
  currentPayload = payload;
}

export function setCurrentInitiativeId(id) {
  currentInitiativeId = id;
}

export function getCurrentPayload() {
  return currentPayload;
}

export function getCurrentInitiativeId() {
  return currentInitiativeId;
}

export function operatorName() {
  return currentOperator || localStorage.getItem("let_them_cook_exported_by") || "Unknown";
}

export function setHello(name) {
  const el = document.getElementById("hello-line");
  if (el) el.textContent = name ? ("Hello, " + name) : "Hello";
}

export function setSharePathDisplay(path) {
  sharePath = path || JSON_FOLDER_DISPLAY_NAME;
  const a = document.getElementById("share-path-code");
  const b = document.getElementById("folder-path-code");
  if (a) a.textContent = sharePath;
  if (b) b.textContent = sharePath;
}

export function cachePayload() {
  try {
    const json = JSON.stringify(buildSharePayload());
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(DEMO_DASHBOARD_KEY, json);
  } catch (error) {
    console.error("Optional cache skipped.", error);
  }
}

export function resetDashboard() {
  if (!confirm("Clear the optional local cache on this computer and reload? The shared data/initiatives.json is not deleted.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DEMO_DASHBOARD_KEY);
  location.reload();
}

function collectInitiatives() {
  const initiatives = (currentPayload?.initiatives || []).map(init => ({
    ...init,
    sections: (init.sections || []).map(section => ({ ...section }))
  }));
  const current = initiatives.find(init => init.id === currentInitiativeId);
  if (!current) return initiatives;

  current.name = document.getElementById("initiative-name")?.value.trim() || "Unnamed";
  current.status = document.getElementById("initiative-status")?.value || "active";
  current.owner = document.getElementById("initiative-owner")?.value.trim() || "";
  current.startDate = document.getElementById("initiative-start-date")?.value || "";
  current.sections = [];
  document.querySelectorAll(".section-editor").forEach(sectionEl => {
    const section = collectSectionPayload(sectionEl.dataset.id);
    if (section) {
      section.name = sectionEl.querySelector(".section-name")?.value.trim() || "Section";
      current.sections.push(section);
    }
  });
  return initiatives;
}

export function buildSharePayload() {
  const operator = operatorName();
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    updatedBy: operator,
    items: [],
    sharedNotes: document.getElementById("sharedNotes")?.value || "",
    meta: { app: APP_TITLE },
    schema: "let-them-cook-dashboard",
    schemaVersion: "3.0.0",
    exportedAt: now,
    exportedBy: operator,
    source: isTauri() ? "LetThemCook.exe" : "Browser preview",
    intendedFolderDisplayName: JSON_FOLDER_DISPLAY_NAME,
    userPathNote: sharePath || "C:\\Users\\Your.User.Name\\OneDrive - USTSA\\FACTTT",
    initiatives: collectInitiatives()
  };
}

export function updateProgress() {
  const checkboxes = document.querySelectorAll(".task-list input[type='checkbox']");
  const checked = document.querySelectorAll(".task-list input[type='checkbox']:checked");
  checkboxes.forEach(box => {
    const li = box.closest("li");
    if (box.checked) li.classList.add("task-complete");
    else li.classList.remove("task-complete");
  });
  const percent = checkboxes.length === 0 ? 0 : Math.round((checked.length / checkboxes.length) * 100);
  const pe = document.getElementById("progressValue");
  const pb = document.getElementById("progressBar");
  if (pe) pe.textContent = percent + "%";
  if (pb) pb.style.width = percent + "%";
  cachePayload();
}

export function updateMetrics() {
  const progress = document.querySelectorAll(".task-list input[type='checkbox']");
  const checked = document.querySelectorAll(".task-list input[type='checkbox']:checked");
  const percent = progress.length === 0 ? 0 : Math.round((checked.length / progress.length) * 100);
  const pe = document.getElementById("progressValue");
  const pb = document.getElementById("progressBar");
  if (pe) pe.textContent = percent + "%";
  if (pb) pb.style.width = percent + "%";
  let totalIdeas = 0;
  document.querySelectorAll(".section-editor table tbody tr:not([data-deleted='true'])").forEach(() => totalIdeas++);
  const ic = document.getElementById("ideaCount");
  const iic = document.getElementById("initiativeCount");
  if (ic) ic.textContent = totalIdeas;
  if (iic) iic.textContent = (currentPayload?.initiatives || []).length;
  cachePayload();
}

export function bindUiEvents() {
  if (document.body.dataset.eventsBound === "true") return;
  document.body.dataset.eventsBound = "true";
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    switch (action) {
      case "refresh": refreshFromShare(); break;
      case "save": saveToInbox(); break;
      case "print": window.print(); break;
      case "toggle-more": toggleMoreActions(); break;
      case "reset": resetDashboard(); break;
      default: console.warn("Unknown UI action:", action);
    }
  });
}

export function initializeUi() {
  bindUiEvents();
  window.addEventListener("error", event => {
    console.error("Unhandled application error:", event.error || event.message);
    showToast("Application error: " + (event.message || "Unknown JavaScript error"), "err");
  });
  window.addEventListener("unhandledrejection", event => {
    console.error("Unhandled promise rejection:", event.reason);
    showToast("Application operation failed. See the console for details.", "err");
  });
}

export async function refreshFromShare() {
  try {
    let payload;
    if (isTauri()) {
      payload = await invokeCommand("read_dashboard");
    } else {
      const raw = localStorage.getItem(DEMO_DASHBOARD_KEY);
      payload = raw ? JSON.parse(raw) : null;
      if (!payload) {
        showToast("No shared dashboard yet — showing built-in starter content.", "ok");
        return EMPTY_PAYLOAD;
      }
    }
    const migrated = migrateToV3(payload);
    currentPayload = migrated;
    setCurrentPayload(migrated);
    if (typeof renderInitiativeList === "function") renderInitiativeList(migrated);
    updateMetrics();
    cachePayload();
    showToast("Refreshed from data/initiatives.json", "ok");
    return migrated;
  } catch (error) {
    console.error(error);
    showToast("Refresh failed: " + (error.message || error), "err");
  }
}

export async function saveToInbox() {
  const payload = buildSharePayload();
  try {
    if (isTauri()) {
      await invokeCommand("write_dashboard", { payload });
      const written = await invokeCommand("write_submit", { payload });
      showToast("Saved to initiatives.json and inbox: " + written, "ok");
    } else {
      localStorage.setItem(DEMO_DASHBOARD_KEY, JSON.stringify(payload, null, 2));
      showToast("Saved. Refresh will keep your edits in this preview.", "ok");
    }
    cachePayload();
  } catch (error) {
    console.error(error);
    cachePayload();
    showToast("Save failed: " + (error.message || error), "err");
  }
}

function migrateToV3(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload.initiatives)) return payload;
  const movements = payload.movements || {};
  const sections = [];
  for (const [key, block] of Object.entries(movements)) {
    if (!block || typeof block !== "object") continue;
    sections.push({
      id: key,
      name: block.label || key,
      ideas: Array.isArray(block.ideas) ? block.ideas : [],
      actions: Array.isArray(block.actions) ? block.actions : [],
      questions: Array.isArray(block.questions) ? block.questions : [],
      flow: block.flow || null
    });
  }
  const initiatives = sections.length > 0 ? [{ id: "legacy", name: "Legacy Initiative", sections }] : [];
  return { ...payload, initiatives, schema: "let-them-cook-dashboard", schemaVersion: "3.0.0" };
}
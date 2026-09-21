// js/stores/state.js — Let Them Cook v4 tabbed shell
import { escapeHtml, normalizeText } from "../utils/strings.js";
import { getTauriInvoke, isTauri, invokeCommand } from "../utils/tauri.js";
import { showToast, toggleMoreActions } from "../utils/ui.js";
import { collectSectionPayload } from "../data/store.js";
import { EMPTY_PAYLOAD, buildDemoStarterPayload, isValidPayload } from "../data/schema.js";
import { migrateToV4 } from "../data/migrations.js";
import { renderDashboard } from "../pages/dashboard.js";
import { renderProblemsPage, showProblemEditor, hideProblemEditor, saveProblem, deleteProblem, editProblem } from "../pages/problems.js";
import { renderAnalytics } from "../pages/analytics.js";
import { renderInitiativeList, openInitiativeEditor, addInitiative, deleteInitiative as deleteInitiativeById, saveCurrentInitiative, backToInitiativesList } from "../components/initiative.js";
import { addRootNote, replyToNote, saveReply } from "../components/notes.js";

export const STORAGE_KEY = "let_them_cook_initiatives_facttt_v4";
export const DEMO_DASHBOARD_KEY = "ltc_preview_initiatives_json";
export const JSON_FOLDER_DISPLAY_NAME = "OneDrive - USTSA\\FACTTT";
export const APP_TITLE = "Let Them Cook";

let currentPayload = null;
let currentTab = "dashboard";
let currentInitiativeId = null;
let currentOperator = "";
let sharePath = "";
let toastTimer = null;

export { escapeHtml, normalizeText };
export { showToast, toggleMoreActions };
export { EMPTY_PAYLOAD };

export function setCurrentPayload(payload) { currentPayload = payload; }
export function getCurrentPayload() { return currentPayload; }
export function setCurrentInitiativeId(id) { currentInitiativeId = id; }
export function getCurrentInitiativeId() { return currentInitiativeId; }
export function operatorName() { return currentOperator || localStorage.getItem("let_them_cook_exported_by") || "Unknown"; }
export function setHello(name) {
  const el = document.getElementById("hello-line");
  if (el) el.textContent = name ? ("Hello, " + name) : "Hello";
}
export function setSharePathDisplay(path) {
  sharePath = path || JSON_FOLDER_DISPLAY_NAME;
  const a = document.getElementById("share-path-code");
  if (a) a.textContent = sharePath;
}
export function cachePayload() {
  try {
    const json = JSON.stringify(buildSharePayload());
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(DEMO_DASHBOARD_KEY, json);
  } catch (error) { console.error("Optional cache skipped.", error); }
}
export function resetDashboard() {
  if (!confirm("Clear the optional local cache on this computer and reload? The shared data/initiatives.json is not deleted.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DEMO_DASHBOARD_KEY);
  location.reload();
}
export function setCurrentTab(tab) { currentTab = tab; }
export function getCurrentTab() { return currentTab; }

export function buildSharePayload() {
  const operator = operatorName();
  const now = new Date().toISOString();
  return {
    version: 1, updatedAt: now, updatedBy: operator, items: [],
    sharedNotes: document.getElementById("sharedNotes")?.value || "",
    meta: { app: APP_TITLE }, schema: "let-them-cook-dashboard", schemaVersion: "4.0.0",
    exportedAt: now, exportedBy: operator,
    source: isTauri() ? "LetThemCook.exe" : "Browser preview",
    intendedFolderDisplayName: JSON_FOLDER_DISPLAY_NAME,
    userPathNote: sharePath || "C:\\Users\\Your.User.Name\\OneDrive - USTSA\\FACTTT",
    problems: (currentPayload?.problems || []),
    initiatives: collectInitiatives()
  };
}

function collectInitiatives() {
  const initiatives = (currentPayload?.initiatives || []).map(init => ({
    ...init,
    sections: (init.sections || []).map(section => ({ ...section }))
  }));
  const current = initiatives.find(init => init.id === currentInitiativeId);
  if (!current) return initiatives;

  current.name = document.getElementById("initiative-name")?.value.trim() || "Unnamed";
  current.status = document.getElementById("initiative-status")?.value || "New";
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

export function updateProgress() {
  const checkboxes = document.querySelectorAll(".task-list input[type='checkbox']");
  const checked = document.querySelectorAll(".task-list input[type='checkbox']:checked");
  checkboxes.forEach(box => {
    const li = box.closest("li");
    if (box.checked) li.classList.add("task-complete"); else li.classList.remove("task-complete");
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
  const ai = document.getElementById("analytics-ideas");
  const aa = document.getElementById("analytics-actions");
  const ai2 = document.getElementById("analytics-initiatives");
  const ap = document.getElementById("analytics-progress");
  if (ai) ai.textContent = totalIdeas;
  if (aa) aa.textContent = (currentPayload?.initiatives || []).reduce((s, i) => s + (i.sections || []).reduce((s2, sec) => s2 + (sec.actions || []).length, 0), 0);
  if (ai2) ai2.textContent = (currentPayload?.initiatives || []).length;
  if (ap) ap.textContent = `${percent}%`;
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
      case "tab": switchTab(target.dataset.tab); break;
      case "add-problem": showProblemEditor(null); break;
      case "add-initiative": addInitiative(); break;
      case "save-problem": saveProblem(); break;
      case "cancel-problem": hideProblemEditor(); break;
      case "delete-problem": deleteProblem(target.dataset.id); break;
      case "save-initiative": saveCurrentInitiative(); break;
      case "back-initiatives": backToInitiativesList(); break;
      case "delete-initiative": deleteInitiative(target.dataset.id); break;
      case "open-initiative": openInitiativeEditor(target.dataset.id); break;
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
      let cached = null;
      try { cached = raw ? JSON.parse(raw) : null; } catch { cached = null; }
      if (!cached || !cached.initiatives || cached.initiatives.length === 0) {
        const starter = buildDemoStarterPayload();
        localStorage.setItem(DEMO_DASHBOARD_KEY, JSON.stringify(starter));
        payload = starter;
        showToast("Browser preview — loaded demo initiatives.", "ok");
      } else {
        payload = cached;
        showToast("Refreshed from browser demo store.", "ok");
      }
    }
    const migrated = migrateToV4(payload);
    currentPayload = migrated;
    setCurrentPayload(migrated);
    renderCurrentTab(migrated);
    if (!isTauri()) return migrated;
    showToast("Refreshed from data/initiatives.json", "ok");
    return migrated;
  } catch (error) {
    console.error(error);
    showToast("Refresh failed: " + (error.message || error), "err");
  }
}

export async function saveToInbox() {
  const payload = buildSharePayload();
  if (!payload) return;
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

export function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll(".top-tabs .tab-button").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  document.querySelectorAll(".page").forEach(p => {
    const isTarget = p.id === `page-${tabName}`;
    p.hidden = !isTarget;
    p.classList.toggle("active", isTarget);
  });
  renderCurrentTab(currentPayload);
}

export function renderCurrentTab(payload) {
  switch (currentTab) {
    case "dashboard": renderDashboard(payload); break;
    case "problems": renderProblemsPage(payload); break;
    case "initiatives": renderInitiativeList(payload); break;
    case "analytics": renderAnalytics(payload); break;
    default: renderDashboard(payload);
  }
}

export const state = {
  escapeHtml, normalizeText, showToast, toggleMoreActions, EMPTY_PAYLOAD,
  setCurrentPayload, getCurrentPayload, setCurrentInitiativeId, getCurrentInitiativeId,
  operatorName, setHello, setSharePathDisplay, cachePayload, resetDashboard,
  buildSharePayload, updateProgress, updateMetrics, bindUiEvents, initializeUi,
  refreshFromShare, saveToInbox, switchTab, renderCurrentTab, setCurrentTab, getCurrentTab
};
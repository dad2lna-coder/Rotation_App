// js/components/navigation.js — UI v2 tab shell controller
const TAB_IDS = ["dashboard", "problems", "initiatives", "analytics"];

let activeTab = "dashboard";

function switchTab(tabId) {
  if (!TAB_IDS.includes(tabId)) return;
  activeTab = tabId;
  for (const id of TAB_IDS) {
    const btn = document.getElementById(`tab-btn-${id}`);
    const panel = document.getElementById(`panel-${id}`);
    if (btn) {
      btn.classList.toggle("active", id === tabId);
      btn.setAttribute("aria-selected", id === tabId ? "true" : "false");
    }
    if (panel) panel.hidden = id !== tabId;
  }
  document.dispatchEvent(new CustomEvent("ltc:tab-change", { detail: { tab: tabId } }));
}

export function showTab(tabId) {
  switchTab(tabId);
}

export function getActiveTab() {
  return activeTab;
}

export function bindTabs() {
  const bar = document.getElementById("tabbar");
  if (!bar || bar.dataset.tabsBound === "true") return;
  bar.dataset.tabsBound = "true";
  bar.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const initial = new URLSearchParams(location.search).get("tab");
  switchTab(TAB_IDS.includes(initial) ? initial : activeTab);
}
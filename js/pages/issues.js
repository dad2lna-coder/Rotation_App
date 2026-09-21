// js/pages/issues.js — Let Them Cook

import { state } from "../stores/state.js";
import { migrateToV4 } from "./data/migrations.js";
import { showToast } from "./data/ui.js";
import { createInitiative, deleteInitiative, getInitiativeById } from "./data/initiatives.js";

export function renderInitiativeList(payload) {
  const container = document.getElementById("initiative-list");
  if (!container) return;
  container.innerHTML = "";
  const initiatives = payload.initiatives || [];
  if (initiatives.length === 0) {
    container.innerHTML = `<div class="empty-state">No initiatives yet. Click “New initiative” to start.</div>`;
    return;
  }
  initiatives.forEach((initiative) => {
    const card = document.createElement("div");
    card.className = "initiative-card";
    card.dataset.id = initiative.id;
    card.innerHTML = `
      <div class="initiative-header">
        <strong>${escapeHtml(initiative.name || "Unnamed")}</strong>
        <span class="status-pill status-${(initiative.status || "New").toLowerCase()}">${initiative.status || "New"}</span>
      </div>
      <div class="initiative-meta">
        <span>Sections: ${(initiative.sections || []).length}</span>
        <button type="button" class="secondary" onclick="window.openInitiativeEditor('${initiative.id}')">Open</button>
        <button type="button" class="danger" onclick="window.removeInitiative('${initiative.id}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

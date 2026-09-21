// js/pages/problems.js — Let Them Cook v4

import { state } from "../stores/state.js";
import { escapeHtml } from "../utils/strings.js";

export function renderProblemsPage(payload) {
  const listContainer = document.getElementById("problems-list");
  if (!listContainer) return;
  listContainer.innerHTML = "";
  const problems = payload.problems || [];
  if (problems.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">No problems yet. Click "Add problem" to start.</div>';
    return;
  }
  problems.forEach(problem => {
    const card = document.createElement("div");
    card.className = "problem-card";
    card.dataset.id = problem.id;
    card.innerHTML = `
      <div class="problem-header">
        <strong>${escapeHtml(problem.title || "")}</strong>
        <span class="priority-pill priority-${problem.priority || "medium"}">${problem.priority || "medium"}</span>
      </div>
      <div class="problem-body editable-content" contenteditable="true">${escapeHtml(problem.body || "")}</div>
      <div class="problem-footer">
        <button type="button" class="secondary" onclick="window.editProblem('${problem.id}')">Edit</button>
        <button type="button" class="danger" onclick="window.deleteProblem('${problem.id}')">Delete</button>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

export function showProblemEditor(problemId = null) {
  const editor = document.getElementById("problem-editor");
  const listSection = document.getElementById("page-problems");
  if (!editor || !listSection) return;
  listSection.querySelector(".problem-list").style.display = "none";
  editor.hidden = false;
  editor.style.display = "block";
  const titleEl = document.getElementById("problem-editor-title");
  if (titleEl) titleEl.textContent = problemId ? "Edit problem" : "Add problem";
  const titleInput = document.getElementById("problem-title");
  const bodyInput = document.getElementById("problem-body");
  const prioritySelect = document.getElementById("problem-priority");
  if (titleInput) titleInput.value = "";
  if (bodyInput) bodyInput.value = "";
  if (prioritySelect) prioritySelect.value = "medium";
  if (problemId) {
    const payload = state.getCurrentPayload();
    const problem = (payload?.problems || []).find(p => p.id === problemId);
    if (problem) {
      if (titleInput) titleInput.value = problem.title || "";
      if (bodyInput) bodyInput.value = problem.body || "";
      if (prioritySelect) prioritySelect.value = problem.priority || "medium";
      const deleteBtn = editor.querySelector('[data-action="delete-problem"]');
      if (deleteBtn) { deleteBtn.dataset.id = problemId; deleteBtn.style.display = "inline-block"; }
    }
  } else {
    const deleteBtn = editor.querySelector('[data-action="delete-problem"]');
    if (deleteBtn) deleteBtn.style.display = "none";
  }
}

export function hideProblemEditor() {
  const editor = document.getElementById("problem-editor");
  const listSection = document.getElementById("page-problems");
  if (!editor || !listSection) return;
  editor.hidden = true;
  editor.style.display = "none";
  listSection.querySelector(".problem-list").style.display = "block";
}

export function collectProblemForm() {
  const titleInput = document.getElementById("problem-title");
  const bodyInput = document.getElementById("problem-body");
  const prioritySelect = document.getElementById("problem-priority");
  return {
    id: Date.now().toString(),
    title: titleInput ? titleInput.value.trim() : "",
    body: bodyInput ? bodyInput.value.trim() : "",
    priority: prioritySelect ? prioritySelect.value : "medium",
    createdAt: new Date().toISOString()
  };
}
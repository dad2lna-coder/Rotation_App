import { escapeHtml } from "../utils/strings.js";
import { showToast } from "../utils/ui.js";
import { addPayloadIdeaRow, updateProgress as storeUpdateProgress } from "../data/store.js";
import { cachePayload, updateMetrics } from "../stores/state.js";

export function addIdea(sectionId) {
  const ideaInput = document.getElementById(sectionId + "-ideaText");
  const howInput = document.getElementById(sectionId + "-ideaHow");
  const prosInput = document.getElementById(sectionId + "-ideaPros");
  if (!ideaInput) return;
  const idea = ideaInput.value.trim();
  const how = (howInput?.value || "").trim();
  const pros = (prosInput?.value || "").trim();
  if (!idea) {
    alert("Please enter an idea or proposal.");
    return;
  }
  addPayloadIdeaRow(sectionId + "-ideas", {
    idea,
    contributor: how || "@Name",
    prosAndConcerns: pros || "Pending discussion",
    feedback: 0,
    deleted: false
  });
  ideaInput.value = "";
  if (howInput) howInput.value = "";
  if (prosInput) prosInput.value = "";
  updateMetrics();
  cachePayload();
  showToast("Idea added. Click Save to write it to FACTTT.", "ok");
}

export function addQuestion(questionListId, inputId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(questionListId);
  if (!input || !list) return;
  const text = input.value.trim();
  if (!text) {
    alert("Please enter a discussion question.");
    return;
  }
  const li = document.createElement("li");
  li.innerHTML = `<span contenteditable="true">${escapeHtml(text)}</span> <button type="button" class="item-delete-btn" onclick="window.deleteItem(this)" title="Delete question">✕</button>`;
  list.appendChild(li);
  input.value = "";
  cachePayload();
  showToast("Question added. Click Save to write it to FACTTT.", "ok");
}

export function addAction(taskListId, inputId) {
  const input = document.getElementById(inputId);
  const taskList = document.getElementById(taskListId);
  if (!input || !taskList) return;
  const text = input.value.trim();
  if (!text) {
    alert("Please enter an action item.");
    return;
  }
  const li = document.createElement("li");
  li.innerHTML = `<input type="checkbox" onchange="window.updateProgress()"> <span contenteditable="true">${escapeHtml(text)}</span> <button type="button" class="item-delete-btn" onclick="window.deleteAction(this)" title="Delete action item">✕</button>`;
  taskList.appendChild(li);
  input.value = "";
  updateProgress();
  cachePayload();
  showToast("Action added. Click Save to write it to FACTTT.", "ok");
}

export function deleteIdea(button) {
  const row = button?.closest("tr");
  if (!row) return;
  row.setAttribute("data-deleted", "true");
  row.style.display = "none";
  updateMetrics();
  cachePayload();
  showToast("Idea removed. Click Save to write the change.", "ok");
}

export function deleteItem(button) {
  const li = button?.closest("li");
  if (!li) return;
  li.remove();
  cachePayload();
  showToast("Removed. Click Save to write the change.", "ok");
}

export function deleteAction(button) {
  const li = button?.closest("li");
  if (!li) return;
  li.remove();
  updateProgress();
  cachePayload();
  showToast("Action removed. Click Save to write the change.", "ok");
}

export function changeFeedback(button, delta) {
  const numberSpan = button?.parentElement?.querySelector(".feedback-number");
  if (!numberSpan) return;
  let value = parseInt(numberSpan.textContent || "0", 10) + Number(delta || 0);
  if (value < 0) value = 0;
  numberSpan.textContent = String(value);
  updateMetrics();
  cachePayload();
}

export function updateProgress() {
  storeUpdateProgress();
  cachePayload();
}
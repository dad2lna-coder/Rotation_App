import { state } from './stores/state.js';
import { isValidPayload, EMPTY_PAYLOAD } from './data/schema.js';
import { migrateToV3 } from './data/migrations.js';
import { refreshFromShare, saveToInbox, importJsonPayload } from './actions/data.js';
import { renderInitiativeList, renderInitiativeEditor, addInitiative, deleteInitiative, addSection, saveCurrentInitiative } from './components/initiative.js';

// Expose global functions for inline onclick handlers
window.changeFeedback = (button, delta) => {
  const numberSpan = button.parentElement.querySelector(".feedback-number");
  let value = parseInt(numberSpan.textContent || "0", 10);
  value += delta;
  if (value < 0) value = 0;
  numberSpan.textContent = value;
  updateMetrics();
  state.cachePayload();
};

window.addIdea = (sectionId) => {
  const ideaInput = document.getElementById(`${sectionId}-ideaText`);
  const howInput = document.getElementById(`${sectionId}-ideaHow`);
  const prosInput = document.getElementById(`${sectionId}-ideaPros`);
  const idea = ideaInput.value.trim();
  if (!idea) {
    alert("Please enter an idea or proposal.");
    return;
  }
  addPayloadIdeaRow(`${sectionId}-ideas`, {
    idea: idea,
    contributor: howInput.value.trim() || "@Name",
    prosAndConcerns: prosInput.value.trim() || "Pending discussion",
    feedback: 0,
    deleted: false
  });
  ideaInput.value = "";
  howInput.value = "";
  prosInput.value = "";
  updateMetrics();
  state.cachePayload();
  showToast("Idea added. Click Save to write it to FACTTT.", "ok");
};

window.deleteIdea = (button) => {
  const row = button.closest('tr');
  if (row) {
    row.setAttribute('data-deleted', 'true');
    row.style.display = 'none';
    updateMetrics();
    state.cachePayload();
    showToast("Idea removed. Click Save to write the change.", "ok");
  }
};

window.addListItem = (listId, inputId, kind) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast("Please enter a " + String(kind || "item").toLowerCase() + " first.", "err");
    return;
  }
  const list = document.getElementById(listId);
  if (!list) return;
  list.appendChild(makeEditableListItem(text));
  input.value = "";
  state.cachePayload();
  showToast((kind || "Item") + " added. Click Save to write it to FACTTT.", "ok");
};

window.makeEditableListItem = (text) => {
  const li = document.createElement("li");
  li.innerHTML = `
    <span contenteditable="true">${state.escapeHtml(text)}</span>
    <button type="button" class="item-delete-btn" onclick="deleteItem(this)" title="Delete">✕</button>
  `;
  return li;
};

window.decorateEditableList = (listId) => {
  const list = document.getElementById(listId);
  if (!list) return;
  Array.from(list.querySelectorAll("li")).forEach((li) => {
    if (li.querySelector(".item-delete-btn")) return;
    const text = li.innerText.trim();
    li.removeAttribute("contenteditable");
    li.innerHTML = `
      <span contenteditable="true">${state.escapeHtml(text)}</span>
      <button type="button" class="item-delete-btn" onclick="deleteItem(this)" title="Delete">✕</button>
    `;
  });
};

window.addAction = (taskListId, inputId) => {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) {
    alert('Please enter an action item.');
    return;
  }
  const taskList = document.getElementById(taskListId);
  const li = document.createElement('li');
  li.innerHTML = `
    <input type="checkbox" onchange="updateProgress()">
    <span contenteditable="true">${state.escapeHtml(text)}</span>
    <button type="button" class="item-delete-btn" onclick="deleteAction(this)" title="Delete action item">✕</button>
  `;
  taskList.appendChild(li);
  input.value = '';
  updateProgress();
  state.cachePayload();
  showToast("Action added. Click Save to write it to FACTTT.", "ok");
};

window.deleteAction = (button) => {
  const li = button.closest('li');
  if (li) {
    li.remove();
    updateProgress();
    state.cachePayload();
    showToast("Action removed. Click Save to write the change.", "ok");
  }
};

window.addQuestion = (questionListId, inputId) => {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) {
    alert('Please enter a discussion question.');
    return;
  }
  const list = document.getElementById(questionListId);
  const li = document.createElement('li');
  li.innerHTML = `
    <span contenteditable="true">${state.escapeHtml(text)}</span>
    <button type="button" class="item-delete-btn" onclick="deleteItem(this)" title="Delete question">✕</button>
  `;
  list.appendChild(li);
  input.value = '';
  state.cachePayload();
  showToast("Question added. Click Save to write it to FACTTT.", "ok");
};

window.deleteItem = (button) => {
  const li = button.closest('li');
  if (li) {
    li.remove();
    state.cachePayload();
    showToast("Removed. Click Save to write the change.", "ok");
  }
};

window.showTab = (tabId) => {
  document.querySelectorAll(".movement-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.remove("active");
  });
  const selectedPanel = document.getElementById(tabId);
  if (selectedPanel) {
    selectedPanel.classList.add("active");
  }
};

window.toggleSection = (sectionId, button) => {
  const content = document.getElementById(sectionId);
  content.classList.toggle('collapsed');
  if (content.classList.contains('collapsed')) {
    button.textContent = 'Expand';
  } else {
    button.textContent = 'Collapse';
  }
};

window.updateProgress = () => {
  const checkboxes = document.querySelectorAll('.task-list input[type="checkbox"]');
  const checked = document.querySelectorAll('.task-list input[type="checkbox"]:checked');
  checkboxes.forEach(box => {
    const li = box.closest("li");
    if (box.checked) {
      li.classList.add("task-complete");
    } else {
      li.classList.remove("task-complete");
    }
  });
  const percent = checkboxes.length === 0
    ? 0
    : Math.round((checked.length / checkboxes.length) * 100);
  document.getElementById("progressValue").textContent = percent + "%";
  document.getElementById("progressBar").style.width = percent + "%";
  state.cachePayload();
};

window.updateMetrics = () => {
  const totalIdeaRows = document.querySelectorAll("#ndoIdeas tbody tr:not([data-deleted='true'])").length +
      document.querySelectorAll("#trainingIdeas tbody tr:not([data-deleted='true'])").length +
      document.querySelectorAll("#tsstIdeas tbody tr:not([data-deleted='true'])").length;
  document.getElementById("ideaCount").textContent = totalIdeaRows;
  updateProgress();
};

window.importJsonPayload = importJsonPayload;
window.refreshFromShare = refreshFromShare;
window.saveToInbox = saveToInbox;

// Boot
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const payload = await refreshFromShare();
    const migrated = migrateToV3(payload);
    renderInitiativeList(migrated);
    updateMetrics();
  } catch (error) {
    console.error("Initialization failed:", error);
    showToast("Application initialization failed.", "err");
  }
});

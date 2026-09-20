import { escapeHtml } from "../utils/strings.js";

function normalizeIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.map(item => ({
    idea: item.idea || "", contributor: item.contributor || "",
    prosAndConcerns: item.prosAndConcerns || item.pros || "",
    feedback: Number(item.feedback || 0), deleted: Boolean(item.deleted)
  }));
}

function collectTablePayload(tableId) {
  const rows = [];
  document.querySelectorAll(`#${tableId} tbody tr`).forEach((row, index) => {
    const cells = row.querySelectorAll("td");
    rows.push({
      id: `${tableId}-${index + 1}`,
      idea: cells[0]?.innerText?.trim() || "",
      contributor: cells[1]?.innerText?.trim() || "",
      prosAndConcerns: cells[2]?.innerText?.trim() || "",
      feedback: Number(cells[3]?.querySelector(".feedback-number")?.textContent || 0),
      deleted: row.getAttribute('data-deleted') === 'true'
    });
  });
  return rows;
}

function collectTasksForPanel(taskListId) {
  const taskList = document.getElementById(taskListId);
  if (!taskList) return [];
  return Array.from(taskList.querySelectorAll("li")).map((li, index) => {
    const checkbox = li.querySelector("input[type='checkbox']");
    const span = li.querySelector("span");
    return { id: `${taskListId}-task-${index + 1}`, text: span?.innerText.trim() || "", complete: Boolean(checkbox?.checked) };
  });
}

function collectQuestionsForPanel(listId) {
  const list = document.getElementById(listId);
  if (!list) return [];
  return Array.from(list.querySelectorAll("li span")).map(span => span.innerText.trim()).filter(Boolean);
}

function collectFlowDetails(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return null;
  const flowItems = panel.querySelectorAll(".flow-item");
  if (flowItems.length < 6) return null;
  return {
    currentRecipients: Array.from(flowItems[0].querySelectorAll(".tag")).map(t => t.innerText.trim()),
    teamsNotification: Array.from(flowItems[1].querySelectorAll(".tag")).map(t => t.innerText.trim()),
    personnel: flowItems[2].querySelector(".editable-content")?.innerText.trim() || "",
    notificationNeed: flowItems[3].querySelector(".editable-content")?.innerText.trim() || "",
    movementPath: flowItems[4].querySelector(".editable-content")?.innerText.trim() || "",
    status: flowItems[5].querySelector(".status-pill")?.innerText.trim() || "Discovery Needed"
  };
}

function applyFlowDetails(panelId, flowData) {
  if (!flowData) return;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const flowItems = panel.querySelectorAll(".flow-item");
  if (flowItems.length < 6) return;
  if (Array.isArray(flowData.currentRecipients) && flowData.currentRecipients.length > 0) {
    const container = flowItems[0].querySelector(".tag-list");
    if (container) container.innerHTML = flowData.currentRecipients.map(r => `<span class="tag" contenteditable="true">${escapeHtml(r)}</span>`).join(' ');
  }
  if (Array.isArray(flowData.teamsNotification) && flowData.teamsNotification.length > 0) {
    const container = flowItems[1].querySelector(".tag-list");
    if (container) container.innerHTML = flowData.teamsNotification.map(t => `<span class="tag" contenteditable="true">${escapeHtml(t)}</span>`).join(' ');
  }
  if (flowData.personnel) { const el = flowItems[2].querySelector(".editable-content"); if (el) el.innerText = flowData.personnel; }
  if (flowData.notificationNeed) { const el = flowItems[3].querySelector(".editable-content"); if (el) el.innerText = flowData.notificationNeed; }
  if (flowData.movementPath) { const el = flowItems[4].querySelector(".editable-content"); if (el) el.innerText = flowData.movementPath; }
  if (flowData.status) { const el = flowItems[5].querySelector(".status-pill"); if (el) el.innerText = flowData.status; }
}

function addPayloadIdeaRow(tableId, item) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  const row = document.createElement("tr");
  if (item.deleted) { row.setAttribute('data-deleted', 'true'); row.style.display = 'none'; }
  row.innerHTML = `
    <td contenteditable="true">${escapeHtml(item.idea || "")}</td>
    <td contenteditable="true">${escapeHtml(item.contributor || "")}</td>
    <td contenteditable="true">${escapeHtml(item.prosAndConcerns || "")}</td>
    <td class="feedback-cell">
      <div class="feedback-controls">
        <button type="button" onclick="window.changeFeedback(this, -1)">−</button>
        <span class="feedback-number">${Number(item.feedback || 0)}</span>
        <button type="button" onclick="window.changeFeedback(this, 1)">+</button>
      </div>
    </td>
    <td><button type="button" class="danger" onclick="window.deleteIdea(this)">Delete</button></td>
  `;
  tbody.appendChild(row);
}

function renderPayloadTable(tableId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach(item => addPayloadIdeaRow(tableId, item));
}

function renderPayloadTableFromIdeas(tableId, ideas) {
  renderPayloadTable(tableId, normalizeIdeas(ideas));
}

function applyTasksForPanel(taskListId, tasks) {
  const taskList = document.getElementById(taskListId);
  if (!taskList || !Array.isArray(tasks)) return;
  taskList.innerHTML = '';
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" onchange="window.updateProgress()" ${task.complete ? 'checked' : ''}> <span contenteditable="true">${escapeHtml(task.text)}</span> <button type="button" class="item-delete-btn" onclick="window.deleteAction(this)" title="Delete action item">✕</button>`;
    if (task.complete) li.classList.add('task-complete');
    taskList.appendChild(li);
  });
  updateProgress();
}

function applyQuestionsForPanel(listId, questions) {
  const list = document.getElementById(listId);
  if (!list || !Array.isArray(questions)) return;
  list.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement("li");
    li.innerHTML = `<span contenteditable="true">${escapeHtml(q)}</span> <button type="button" class="item-delete-btn" onclick="window.deleteItem(this)" title="Delete question">✕</button>`;
    list.appendChild(li);
  });
}

function applyProblems(problems) {
  const list = document.getElementById("core-problems-list");
  if (!list) return;
  list.innerHTML = '';
  (problems || []).forEach(p => {
    const card = document.createElement('div');
    card.className = 'problem-card';
    card.innerHTML = `<strong contenteditable="true">${escapeHtml(p.title || '')}</strong><div class="editable-content" contenteditable="true">${escapeHtml(p.body || '')}</div>`;
    list.appendChild(card);
  });
}

function applyListItems(listId, items) {
  const list = document.getElementById(listId);
  if (!list || !Array.isArray(items) || items.length === 0) return;
  list.innerHTML = "";
  items.forEach(text => {
    list.appendChild(makeEditableListItem(String(text)));
  });
}

function makeEditableListItem(text) {
  const li = document.createElement("li");
  li.innerHTML = `<span contenteditable="true">${escapeHtml(text)}</span> <button type="button" class="item-delete-btn" onclick="window.deleteItem(this)" title="Delete">✕</button>`;
  return li;
}

function collectListItems(listId) {
  const list = document.getElementById(listId);
  if (!list) return [];
  return Array.from(list.querySelectorAll("li")).map(li => {
    const span = li.querySelector("span[contenteditable], span");
    const text = (span ? span.innerText : li.innerText).replace("✕", "").trim();
    return text;
  }).filter(Boolean);
}

function initProgress() {
  let percent = 0;
  if (currentPayload && Array.isArray(currentPayload.initiatives)) {
    let total = 0;
    let completed = 0;
    for (const init of currentPayload.initiatives) {
      if (Array.isArray(init.sections)) {
        for (const sec of init.sections) {
          for (const action of sec.actions || []) if (action.complete) completed++;
          (init.sections || []).forEach(() => total++);
          total += (sec.actions || []).length;
        }
      }
    }
    percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  }
  const progress = document.querySelectorAll('.task-list input[type="checkbox"]');
  const checked = document.querySelectorAll('.task-list input[type="checkbox"]:checked');
  const actualPercent = progress.length === 0 ? 0 : Math.round((checked.length / progress.length) * 100);
  if (percent === 0 && actualPercent > 0) percent = actualPercent;
  return { total, completed, percent: percent || actualPercent };
}

function updateProgress() {
  const checkboxes = document.querySelectorAll(".task-list input[type='checkbox']");
  const checked = document.querySelectorAll(".task-list input[type='checkbox']:checked");
  checkboxes.forEach(box => {
    const li = box.closest("li");
    if (box.checked) li.classList.add("task-complete");
    else li.classList.remove("task-complete");
  });
  const percent = checkboxes.length === 0 ? 0 : Math.round((checked.length / checkboxes.length) * 100);
  document.getElementById("progressValue").textContent = percent + "%";
  document.getElementById("progressBar").style.width = percent + "%";
}

function updateMetrics() {
  const progress = document.querySelectorAll(".task-list input[type='checkbox']");
  const checked = document.querySelectorAll(".task-list input[type='checkbox']:checked");
  const percent = progress.length === 0 ? 0 : Math.round((checked.length / progress.length) * 100);
  document.getElementById("progressValue").textContent = percent + "%";
  document.getElementById("progressBar").style.width = percent + "%";
  let totalIdeas = 0;
  document.querySelectorAll(".section-editor table tbody tr:not([data-deleted='true'])").forEach(() => totalIdeas++);
  document.getElementById("ideaCount").textContent = totalIdeas;
  const payload = getCurrentPayload();
  document.getElementById("initiativeCount").textContent = (payload?.initiatives || []).length;
  cachePayload();
}

function collectSectionPayload(sectionId) {
  if (!sectionId) return null;
  const sectionEl = document.querySelector(`.section-editor[data-id="${sectionId}"]`);
  return {
    id: sectionId,
    type: sectionEl?.dataset?.type || "discovery",
    name: sectionEl?.querySelector(".section-name")?.value?.trim() || "Section",
    ideas: collectTablePayload(sectionId + "-ideas"),
    actions: collectTasksForPanel(sectionId + "-task-list"),
    questions: collectQuestionsForPanel(sectionId + "-question-list"),
    flow: collectFlowDetails(sectionId)
  };
}

export { normalizeIdeas, collectTablePayload, collectTasksForPanel, collectQuestionsForPanel, collectFlowDetails, collectSectionPayload, applyFlowDetails, addPayloadIdeaRow, renderPayloadTable, renderPayloadTableFromIdeas, applyTasksForPanel, applyQuestionsForPanel, applyProblems, applyListItems, makeEditableListItem, collectListItems, updateProgress, updateMetrics, initProgress };
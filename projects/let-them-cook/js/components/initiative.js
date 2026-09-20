import { state } from '../stores/state.js';
import { renderSection } from './section.js';

function collectTablePayload(tableId) {
  const rows = [];
  document.querySelectorAll(`#${tableId} tbody tr`).forEach((row, index) => {
    const cells = row.querySelectorAll("td");
    rows.push({ id: `${tableId}-${index + 1}`, idea: cells[0]?.innerText?.trim() || "", contributor: cells[1]?.innerText?.trim() || "", prosAndConcerns: cells[2]?.innerText?.trim() || "", feedback: Number(cells[3]?.querySelector(".feedback-number")?.textContent || 0), deleted: row.getAttribute('data-deleted') === 'true' });
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
  return { currentRecipients: Array.from(flowItems[0].querySelectorAll(".tag")).map(t => t.innerText.trim()), teamsNotification: Array.from(flowItems[1].querySelectorAll(".tag")).map(t => t.innerText.trim()), personnel: flowItems[2].querySelector(".editable-content")?.innerText.trim() || "", notificationNeed: flowItems[3].querySelector(".editable-content")?.innerText.trim() || "", movementPath: flowItems[4].querySelector(".editable-content")?.innerText.trim() || "", status: flowItems[5].querySelector(".status-pill")?.innerText.trim() || "Discovery Needed" };
}

function applyFlowDetails(panelId, flowData) {
  if (!flowData) return;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const flowItems = panel.querySelectorAll(".flow-item");
  if (flowItems.length < 6) return;
  if (Array.isArray(flowData.currentRecipients) && flowData.currentRecipients.length > 0) { const container = flowItems[0].querySelector(".tag-list"); if (container) container.innerHTML = flowData.currentRecipients.map(r => `<span class="tag" contenteditable="true">${state.escapeHtml(r)}</span>`).join(' '); }
  if (Array.isArray(flowData.teamsNotification) && flowData.teamsNotification.length > 0) { const container = flowItems[1].querySelector(".tag-list"); if (container) container.innerHTML = flowData.teamsNotification.map(t => `<span class="tag" contenteditable="true">${state.escapeHtml(t)}</span>`).join(' '); }
  if (flowData.personnel) { const _el = flowItems[2].querySelector(".editable-content"); if (_el) _el.innerText = flowData.personnel; }
  if (flowData.notificationNeed) { const _el = flowItems[3].querySelector(".editable-content"); if (_el) _el.innerText = flowData.notificationNeed; }
  if (flowData.movementPath) { const _el = flowItems[4].querySelector(".editable-content"); if (_el) _el.innerText = flowData.movementPath; }
  if (flowData.status) { const _el = flowItems[5].querySelector(".status-pill"); if (_el) _el.innerText = flowData.status; }
}

export function renderInitiativeList(payload) {
  const container = document.getElementById('initiative-list');
  if (!container) return;
  container.innerHTML = '';
  const initiatives = payload.initiatives || [];
  initiatives.forEach(init => {
    const card = document.createElement('div');
    card.className = 'initiative-card';
    card.dataset.id = init.id;
    card.innerHTML = `<div class="initiative-header"><h4>${state.escapeHtml(init.name || 'Unnamed')}</h4><span class="status-badge status-${init.status || 'active'}">${init.status || 'active'}</span></div><div class="initiative-meta"><span>Sections: ${init.sections.length}</span><span>Owner: ${state.escapeHtml(init.owner || '—')}</span></div><div class="initiative-actions"><button type="button" class="secondary edit-initiative" data-id="${init.id}">Edit</button><button type="button" class="danger delete-initiative" data-id="${init.id}">Delete</button></div>`;
    container.appendChild(card);
  });
  container.querySelectorAll('.edit-initiative').forEach(btn => btn.addEventListener('click', () => openInitiativeEditor(btn.dataset.id, payload)));
  container.querySelectorAll('.delete-initiative').forEach(btn => btn.addEventListener('click', () => deleteInitiative(btn.dataset.id, payload)));
}

export function renderInitiativeEditor(init, payload) {
  const editor = document.getElementById('initiative-editor');
  const list = document.getElementById('initiative-list');
  if (!editor || !list) return;
  list.hidden = true;
  editor.hidden = false;
  document.getElementById('editor-title').textContent = `Editing: ${init.name || 'New Initiative'}`;
  document.getElementById('initiative-name').value = init.name || '';
  document.getElementById('initiative-status').value = init.status || 'active';
  document.getElementById('initiative-owner').value = init.owner || '';
  document.getElementById('initiative-start-date').value = init.startDate || '';
  document.getElementById('delete-initiative-btn').dataset.id = init.id;
  document.getElementById('delete-initiative-btn').hidden = !init.id;
  const sectionsContainer = document.getElementById('sections-container');
  sectionsContainer.innerHTML = '';
  (init.sections || []).forEach((section, index) => renderSection(section, index, init.id, sectionsContainer));
}

export function openInitiativeEditor(id, payload) {
  const init = (payload.initiatives || []).find(i => i.id === id);
  if (!init) return;
  renderInitiativeEditor(init, payload);
}

export function addInitiative(payload) {
  const initiatives = payload.initiatives || [];
  const newId = 'init-' + Date.now();
  const newInitiative = { id: newId, name: 'New Initiative', status: 'active', owner: '', startDate: '', sections: [{ id: newId + '-sec-1', type: 'discovery', name: 'Discovery', ideas: [], actions: [], questions: [] }] };
  initiatives.push(newInitiative);
  payload.initiatives = initiatives;
  renderInitiativeList(payload);
  openInitiativeEditor(newId, payload);
  return newInitiative;
}

export function deleteInitiative(id, payload) {
  if (!confirm('Delete this initiative and all its sections? This cannot be undone.')) return;
  payload.initiatives = (payload.initiatives || []).filter(i => i.id !== id);
  renderInitiativeList(payload);
  const editor = document.getElementById('initiative-editor');
  if (editor) editor.hidden = true;
  const list = document.getElementById('initiative-list');
  if (list) list.hidden = false;
}

export function addSection(initId, payload) {
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  const sectionId = initId + '-sec-' + (init.sections.length + 1);
  const newSection = { id: sectionId, type: 'discovery', name: 'Section ' + (init.sections.length + 1), ideas: [], actions: [], questions: [] };
  init.sections.push(newSection);
  renderInitiativeEditor(init, payload);
}

export function saveCurrentInitiative(initId, payload) {
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  init.name = document.getElementById('initiative-name').value.trim() || 'Unnamed';
  init.status = document.getElementById('initiative-status').value;
  init.owner = document.getElementById('initiative-owner').value.trim();
  init.startDate = document.getElementById('initiative-start-date').value;
  const sectionsContainer = document.getElementById('sections-container');
  init.sections = [];
  sectionsContainer.querySelectorAll('.section-editor').forEach(sectionEl => {
    const secId = sectionEl.dataset.id;
    const ideas = collectTablePayload(secId + '-ideas');
    const actions = collectTasksForPanel(secId + '-task-list');
    const questions = collectQuestionsForPanel(secId + '-question-list');
    const flow = collectFlowDetails(secId);
    init.sections.push({ id: secId, name: sectionEl.querySelector('.section-name')?.value || 'Section', type: sectionEl.dataset.type || 'discovery', ideas, actions, questions, flow });
  });
  return payload;
}
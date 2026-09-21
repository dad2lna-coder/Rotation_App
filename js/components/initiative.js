// js/components/initiative.js — Initiative manager: list + detail + CRUD aligned to index.html page structure
import { state } from '../stores/state.js';
import { renderSection } from './section.js';
import { renderNotesForInitiative } from './notes.js';

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
    personnel: flowItems[2]?.querySelector(".editable-content")?.innerText.trim() || "",
    notificationNeed: flowItems[3]?.querySelector(".editable-content")?.innerText.trim() || "",
    movementPath: flowItems[4]?.querySelector(".editable-content")?.innerText.trim() || "",
    status: flowItems[5]?.querySelector(".status-pill")?.innerText.trim() || "Discovery Needed"
  };
}

// ------------------------------------------------------------------
// Render: Initiative list view
// ------------------------------------------------------------------
export function renderInitiativeList(payload) {
  const container = document.getElementById('initiative-list');
  if (!container) return;
  container.innerHTML = '';
  const initiatives = payload.initiatives || [];
  initiatives.forEach(init => {
    const card = document.createElement('div');
    card.className = 'initiative-card';
    card.dataset.id = init.id;
    const ideaCount = (init.sections || []).reduce((sum, sec) => sum + (sec.ideas || []).length, 0);
    const actionCount = (init.sections || []).reduce((sum, sec) => sum + (sec.actions || []).length, 0);
    const openActions = (init.sections || []).reduce((sum, sec) => sum + (sec.actions || []).filter(a => !a.complete).length, 0);
    const notesCount = (init.notes || []).length;
    card.innerHTML = `
      <div class="initiative-header">
        <h4>${state.escapeHtml(init.name || 'Unnamed initiative')}</h4>
        <span class="status-pill status-${(init.status || 'New').toLowerCase()}">${init.status || 'New'}</span>
      </div>
      <div class="initiative-meta">
        <span>Sections: ${(init.sections || []).length}</span>
        <span>Ideas: ${ideaCount}</span>
        <span>Actions: ${openActions}/${actionCount}</span>
        <span>Notes: ${notesCount}</span>
      </div>
      ${init.startDate ? `<div class="initiative-start">Started ${state.escapeHtml(init.startDate)}</div>` : ''}
      <div class="initiative-actions">
        <button type="button" class="secondary" data-action="open-initiative" data-id="${init.id}">Open</button>
        <button type="button" class="danger" data-action="delete-initiative" data-id="${init.id}">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
  // Wire add/delete/open via data-action (handled by state.bindUiEvents)
  container.querySelectorAll('[data-action="open-initiative"]').forEach(btn => {
    btn.addEventListener('click', () => openInitiativeEditor(btn.dataset.id, payload));
  });
  container.querySelectorAll('[data-action="delete-initiative"]').forEach(btn => {
    btn.addEventListener('click', () => deleteInitiative(btn.dataset.id, payload));
  });
  // Show detail view
  const listView = document.getElementById('initiative-list-view');
  const detailView = document.getElementById('initiative-detail-view');
  if (listView) listView.hidden = false;
  if (detailView) detailView.hidden = true;
}

// ------------------------------------------------------------------
// Render: Initiative detail view (edit properties + sections + notes)
// ------------------------------------------------------------------
export function renderInitiativeEditor(init, payload) {
  const listView = document.getElementById('initiative-list-view');
  const detailView = document.getElementById('initiative-detail-view');
  if (!listView || !detailView) return;
  listView.hidden = true;
  detailView.hidden = false;

  const titleEl = document.getElementById('initiative-detail-title');
  if (titleEl) titleEl.textContent = `Editing: ${init.name || 'New Initiative'}`;

  // Detail toolbar title uses data-action="save-initiative" and "back-initiatives"
  const nameInput = document.getElementById('initiative-name');
  const statusSelect = document.getElementById('initiative-status');
  const startDateInput = document.getElementById('initiative-start-date');

  if (nameInput) nameInput.value = init.name || '';
  if (statusSelect) statusSelect.value = init.status || 'New';
  if (startDateInput) startDateInput.value = init.startDate || '';

  const sectionsContainer = document.getElementById('sections-container');
  if (sectionsContainer) {
    sectionsContainer.innerHTML = '';
    (init.sections || []).forEach((section, index) => {
      renderSection(section, index, init.id, sectionsContainer);
    });
  }

  // Render notes panel
  renderNotesForInitiative(init);
}

export function openInitiativeEditor(id, payload) {
  const init = (payload.initiatives || []).find(i => i.id === id);
  if (!init) return;
  state.setCurrentInitiativeId(id);
  renderInitiativeEditor(init, payload);
}

export function addInitiative(payload) {
  const initiatives = payload.initiatives || [];
  const newId = 'init-' + Date.now();
  const newInitiative = {
    id: newId,
    name: 'New Initiative',
    status: 'New',
    startDate: '',
    notes: [],
    sections: [
      {
        id: newId + '-sec-1',
        type: 'discovery',
        name: 'Discovery',
        notes: [],
        ideas: [],
        actions: [],
        questions: [],
        flow: null
      }
    ]
  };
  initiatives.push(newInitiative);
  payload.initiatives = initiatives;
  state.setCurrentPayload(payload);
  renderInitiativeList(payload);
  openInitiativeEditor(newId, payload);
  return newInitiative;
}

export function deleteInitiative(id, payload) {
  if (!confirm('Delete this initiative and all its sections? This cannot be undone.')) return;
  payload.initiatives = (payload.initiatives || []).filter(i => i.id !== id);
  state.setCurrentPayload(payload);
  renderInitiativeList(payload);
}

export function addSection() {
  const payload = state.getCurrentPayload();
  if (!payload) return;
  const initId = state.getCurrentInitiativeId();
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  const sectionId = initId + '-sec-' + (init.sections.length + 1);
  const newSection = {
    id: sectionId,
    type: 'discovery',
    name: 'Section ' + (init.sections.length + 1),
    notes: [],
    ideas: [],
    actions: [],
    questions: [],
    flow: null
  };
  init.sections.push(newSection);
  state.setCurrentPayload(payload);
  renderInitiativeEditor(init, payload);
}

export function saveCurrentInitiative(payload) {
  const initId = state.getCurrentInitiativeId();
  if (!initId || !payload) return;
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  init.name = document.getElementById('initiative-name')?.value.trim() || 'Unnamed';
  init.status = document.getElementById('initiative-status')?.value || 'New';
  init.startDate = document.getElementById('initiative-start-date')?.value || '';
  // Notes are managed by notes.js and stored in payload
  const sectionsContainer = document.getElementById('sections-container');
  if (sectionsContainer && init.sections) {
    init.sections = [];
    sectionsContainer.querySelectorAll('.section-editor').forEach(sectionEl => {
      const secId = sectionEl.dataset.id;
      const ideas = collectTablePayload(secId + '-ideas');
      const actions = collectTasksForPanel(secId + '-task-list');
      const questions = collectQuestionsForPanel(secId + '-question-list');
      const notes = collectNotesForSection(secId + '-notes');
      const flow = collectFlowDetails(secId);
      init.sections.push({
        id: secId,
        name: sectionEl.querySelector('.section-name')?.value || 'Section',
        type: sectionEl.dataset.type || 'discovery',
        notes: Array.isArray(notes) ? notes : [],
        ideas,
        actions,
        questions,
        flow
      });
    });
  }
  state.setCurrentPayload(payload);
  renderInitiativeList(payload);
  state.cachePayload();
}

// Collect notes from a notes panel DOM element
function collectNotesForSection(notesListId) {
  const list = document.getElementById(notesListId);
  if (!list) return [];
  const notes = [];
  list.querySelectorAll('.note[data-id]:not(.reply)').forEach(noteEl => {
    const id = noteEl.dataset.id;
    const bodyEl = noteEl.querySelector('.note-body');
    const authorEl = noteEl.querySelector('.note-author');
    const createdAt = noteEl.dataset.createdAt || new Date().toISOString();
    const note = {
      id,
      body: bodyEl?.innerText.trim() || '',
      author: authorEl?.value || authorEl?.innerText.trim() || '',
      createdAt,
      parentId: null,
      replies: []
    };
    // Collect replies
    const repliesContainer = noteEl.querySelector('.note-replies');
    if (repliesContainer) {
      repliesContainer.querySelectorAll('.note.reply').forEach(replyEl => {
        const replyId = replyEl.dataset.id;
        const replyBodyEl = replyEl.querySelector('.note-body');
        const replyAuthorEl = replyEl.querySelector('.note-author');
        note.replies.push({
          id: replyId,
          body: replyBodyEl?.innerText.trim() || '',
          author: replyAuthorEl?.value || replyAuthorEl?.innerText.trim() || '',
          createdAt: replyEl.dataset.createdAt || new Date().toISOString(),
          parentId: id
        });
      });
    }
    notes.push(note);
  });
  return notes;
}

export { collectTablePayload, collectTasksForPanel, collectQuestionsForPanel, collectFlowDetails };

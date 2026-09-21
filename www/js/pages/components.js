import { state } from '../stores/state.js';
import { escapeHtml } from '../utils/strings.js';

export function renderProblemCard(problem, compact = false) {
  const card = document.createElement('div');
  card.className = 'problem-card';
  card.dataset.id = problem.id;
  card.innerHTML = `
    <strong>${escapeHtml(problem.title || '')}</strong>
    <div class="editable-content" contenteditable="true">${escapeHtml(problem.body || '')}</div>
    <div class="card-foot">
      <span class="priority-pill priority-${problem.priority || 'medium'}">${problem.priority || 'medium'}</span>
      ${compact ? `<button type="button" class="text-button" data-action="edit-problem" data-id="${problem.id}">Edit</button>` : ''}
    </div>
  `;
  return card;
}

export function renderInitiativeCard(initiative) {
  const card = document.createElement('div');
  card.className = 'initiative-card';
  card.dataset.id = initiative.id;
  const statusClass = (initiative.status || 'New').toLowerCase();
  const ideaCount = (initiative.sections || []).reduce((sum, sec) => sum + (sec.ideas || []).length, 0);
  const actionCount = (initiative.sections || []).reduce((sum, sec) => sum + (sec.actions || []).length, 0);
  const openActions = (initiative.sections || []).reduce((sum, sec) => sum + (sec.actions || []).filter(a => !a.complete).length, 0);

  card.innerHTML = `
    <div class="initiative-header">
      <h4>${escapeHtml(initiative.name || 'Unnamed initiative')}</h4>
      <span class="status-pill status-${statusClass}">${initiative.status || 'New'}</span>
    </div>
    <div class="initiative-meta">
      <span>Sections: ${(initiative.sections || []).length}</span>
      <span>Ideas: ${ideaCount}</span>
      <span>Open actions: ${openActions}/${actionCount}</span>
    </div>
    ${initiative.startDate ? `<div class="initiative-start">Started ${escapeHtml(initiative.startDate)}</div>` : ''}
    <div class="initiative-actions">
      <button type="button" class="secondary" data-action="open-initiative" data-id="${initiative.id}">Open</button>
      <button type="button" class="danger" data-action="delete-initiative" data-id="${initiative.id}">Delete</button>
    </div>
  `;
  return card;
}
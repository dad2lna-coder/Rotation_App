// js/components/section.js — Section editor rendering
import { state } from '../stores/state.js';
import { renderPayloadTableFromIdeas, applyTasksForPanel, applyQuestionsForPanel } from '../data/store.js';

export function renderSection(section, index, initId, container) {
  const div = document.createElement('div');
  div.className = 'section-editor';
  div.dataset.id = section.id;
  div.dataset.type = section.type;
  div.innerHTML = `
    <div class="section-header">
      <input type="text" class="section-name" value="${state.escapeHtml(section.name || 'Section')}" placeholder="Section name" />
      <button type="button" class="danger remove-section" data-section-id="${section.id}">Remove</button>
    </div>
    <div class="flow-grid" id="${section.id}-flow">
      ${renderFlowFields(section.flow || defaultFlow())}
    </div>
    <table id="${section.id}-ideas">
      <thead>
        <tr><th>Idea</th><th>Contributor</th><th>Pros &amp; Concerns</th><th>Feedback</th><th>Action</th></tr>
      </thead>
      <tbody></tbody>
    </table>
    <div class="add-form">
      <input type="text" id="${section.id}-ideaText" placeholder="Enter new idea" />
      <input type="text" id="${section.id}-ideaHow" placeholder="@Name" />
      <input type="text" id="${section.id}-ideaPros" placeholder="Benefits, risks, concerns" />
      <button type="button" onclick="window.addIdea('${section.id}')">Add Idea</button>
    </div>
    <h4>Discussion Questions</h4>
    <ul class="question-list" id="${section.id}-question-list">
      ${(section.questions || []).map(q => `<li><span contenteditable="true">${state.escapeHtml(q)}</span><button type="button" class="item-delete-btn" onclick="window.deleteItem(this)">✕</button></li>`).join('')}
    </ul>
    <div class="add-question-form">
      <input type="text" id="${section.id}-newQuestion" placeholder="Enter new question" />
      <button type="button" onclick="window.addQuestion('${section.id}-question-list', '${section.id}-newQuestion')">Add Question</button>
    </div>
    <h4>Action Items</h4>
    <ul class="task-list" id="${section.id}-task-list">
      ${(section.actions || []).map(a => `<li><input type="checkbox" ${a.complete ? 'checked' : ''} onchange="window.updateProgress()"><span contenteditable="true">${state.escapeHtml(a.text)}</span><button type="button" class="item-delete-btn" onclick="window.deleteAction(this)">✕</button></li>`).join('')}
    </ul>
    <div class="add-task-form">
      <input type="text" id="${section.id}-newTask" placeholder="Enter new action item" />
      <button type="button" onclick="window.addAction('${section.id}-task-list', '${section.id}-newTask')">Add Action</button>
    </div>
  `;
  container.appendChild(div);

  // Render initial data
  if (Array.isArray(section.ideas) && section.ideas.length > 0) {
    renderPayloadTableFromIdeas(section.id + '-ideas', section.ideas);
  }
  if (Array.isArray(section.actions) && section.actions.length > 0) {
    applyTasksForPanel(section.id + '-task-list', section.actions);
  }
  if (Array.isArray(section.questions) && section.questions.length > 0) {
    applyQuestionsForPanel(section.id + '-question-list', section.questions);
  }

  // Attach remove handler
  div.querySelector('.remove-section')?.addEventListener('click', () => {
    const payload = state.getCurrentPayload();
    const init = (payload.initiatives || []).find(i => i.id === initId);
    if (init) {
      init.sections = init.sections.filter(s => s.id !== section.id);
      const sectionsContainer = document.getElementById('sections-container');
      if (sectionsContainer) {
        sectionsContainer.innerHTML = '';
        init.sections.forEach((sec, idx) => renderSection(sec, idx, initId, sectionsContainer));
      }
    }
  });
}

function defaultFlow() {
  return {
    currentRecipients: [],
    teamsNotification: [],
    personnel: '',
    notificationNeed: '',
    movementPath: '',
    status: 'Discovery Needed'
  };
}

function renderFlowFields(flow) {
  return `
    <div class="flow-item">
      <strong>Current Recipients</strong>
      <div class="tag-list">${(flow.currentRecipients || []).map(r => `<span class="tag" contenteditable="true">${state.escapeHtml(r)}</span>`).join(' ')}</div>
    </div>
    <div class="flow-item">
      <strong>Teams Notification</strong>
      <div class="tag-list">${(flow.teamsNotification || []).map(t => `<span class="tag" contenteditable="true">${state.escapeHtml(t)}</span>`).join(' ')}</div>
    </div>
    <div class="flow-item">
      <strong>Personnel</strong>
      <div class="editable-content" contenteditable="true">${state.escapeHtml(flow.personnel || '')}</div>
    </div>
    <div class="flow-item">
      <strong>Notification Need</strong>
      <div class="editable-content" contenteditable="true">${state.escapeHtml(flow.notificationNeed || '')}</div>
    </div>
    <div class="flow-item">
      <strong>Notification Path</strong>
      <div class="editable-content" contenteditable="true">${state.escapeHtml(flow.movementPath || '')}</div>
    </div>
    <div class="flow-item">
      <strong>Status</strong>
      <div class="status-pill" contenteditable="true">${state.escapeHtml(flow.status || 'Discovery Needed')}</div>
    </div>
  `;
}
// js/components/notes.js — Initiative notes: add root notes + reply
import { state } from '../stores/state.js';

let currentNotesInitId = null;

export function setCurrentNotesInitId(id) {
  currentNotesInitId = id;
}

export function getCurrentNotesInitId() {
  return currentNotesInitId;
}

export function renderNotesForInitiative(init) {
  const notesPanel = document.getElementById('initiative-notes-panel');
  if (!notesPanel) return;
  const notesList = document.getElementById('initiative-notes');
  if (notesList) {
    notesList.innerHTML = '';
    const notes = init.notes || [];
    notes.forEach(note => {
      const noteEl = document.createElement('div');
      noteEl.className = 'note';
      noteEl.dataset.id = note.id;
      noteEl.dataset.createdAt = note.createdAt;
      noteEl.innerHTML = `
        <div class="note-header">
          <span class="note-author">${state.escapeHtml(note.author || '—')}</span>
          <span class="note-date">${new Date(note.createdAt).toLocaleString()}</span>
        </div>
        <div class="note-body">${state.escapeHtml(note.body || '')}</div>
        <button type="button" class="secondary small reply-btn" data-action="reply-note" data-id="${note.id}">Reply</button>
        <div class="note-replies"></div>
      `;
      notesList.appendChild(noteEl);
    });
    // Render existing replies into each note's .note-replies container
    notesList.querySelectorAll('.note').forEach(noteEl => {
      const noteData = (init.notes || []).find(n => n.id === noteEl.dataset.id);
      const repliesContainer = noteEl.querySelector('.note-replies');
      if (repliesContainer && noteData && noteData.replies && noteData.replies.length > 0) {
        noteData.replies.forEach(reply => {
          const replyEl = document.createElement('div');
          replyEl.className = 'note reply';
          replyEl.dataset.id = reply.id;
          replyEl.dataset.createdAt = reply.createdAt;
          replyEl.innerHTML = `
            <div class="note-header">
              <span class="note-author">${state.escapeHtml(reply.author || '—')}</span>
              <span class="note-date">${new Date(reply.createdAt).toLocaleString()}</span>
            </div>
            <div class="note-body">${state.escapeHtml(reply.body || '')}</div>
          `;
          repliesContainer.appendChild(replyEl);
        });
      }
    });
  }

  // Render reply forms at bottom
  const notesFormContainer = document.getElementById('initiative-notes-form');
  if (notesFormContainer) {
    notesFormContainer.innerHTML = `
      <textarea id="new-note-body" class="field textarea" placeholder="Add a note..."></textarea>
      <button type="button" class="secondary" data-action="add-note">Add note</button>
    `;
  }
}

export function addRootNote() {
  const payload = state.getCurrentPayload();
  if (!payload) return;
  const body = document.getElementById('new-note-body')?.value?.trim();
  if (!body) {
    alert('Please enter a note body.');
    return;
  }
  const initId = state.getCurrentInitiativeId() || currentNotesInitId;
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  if (!init.notes) init.notes = [];
  const newNote = {
    id: 'note-' + Date.now(),
    body,
    author: state.operatorName(),
    createdAt: new Date().toISOString(),
    parentId: null,
    replies: []
  };
  init.notes.push(newNote);
  state.setCurrentPayload(payload);
  renderNotesForInitiative(init);
  document.getElementById('new-note-body').value = '';
  state.cachePayload();
}

export function replyToNote(parentNoteId) {
  const payload = state.getCurrentPayload();
  if (!payload) return;
  const body = document.querySelector(`[data-action="reply-input"][data-parent="${parentNoteId}"]`)?.value?.trim();
  if (!body) {
    // Show inline reply textarea if not present
    const noteEl = document.querySelector(`[data-id="${parentNoteId}"]`);
    if (noteEl) {
      const repliesContainer = noteEl.querySelector('.note-replies');
      if (repliesContainer) {
        repliesContainer.innerHTML = `
          <div class="note-reply-form">
            <textarea class="note-reply-input field textarea" data-action="reply-input" data-parent="${parentNoteId}" placeholder="Reply..."></textarea>
            <button type="button" class="secondary small" data-action="save-reply" data-id="${parentNoteId}">Save</button>
          </div>
        `;
      }
    }
    return;
  }
  // Save reply
  const initId = state.getCurrentInitiativeId();
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;
  const parentNote = init.notes?.find(n => n.id === parentNoteId);
  if (parentNote && !parentNote.replies) parentNote.replies = [];
  const reply = {
    id: 'reply-' + Date.now(),
    body,
    author: state.operatorName(),
    createdAt: new Date().toISOString(),
    parentId: parentNoteId
  };
  parentNote.replies.push(reply);
  state.setCurrentPayload(payload);
  renderNotesForInitiative(init);
  state.cachePayload();
}

export function saveReply(parentNoteId) {
  const body = document.querySelector(`[data-action="reply-input"][data-parent="${parentNoteId}"]`)?.value?.trim();
  if (!body) return;
  replyToNote(parentNoteId);
}
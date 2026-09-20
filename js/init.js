import { state, setHello, setSharePathDisplay, refreshFromShare, saveToInbox, initializeUi } from './stores/state.js';
import { isValidPayload, EMPTY_PAYLOAD } from './data/schema.js';
import { migrateToV3 } from './data/migrations.js';
import { importJsonPayload } from './actions/data.js';
import { renderInitiativeList, renderInitiativeEditor, addInitiative, deleteInitiative, addSection, saveCurrentInitiative, openInitiativeEditor } from './components/initiative.js';
import { showToast } from './utils/ui.js';
import { isTauri, invokeCommand } from './utils/tauri.js';

// Re-expose action functions globally for inline handlers and data-action wiring
window.importJsonPayload = importJsonPayload;
window.refreshFromShare = refreshFromShare;
window.saveToInbox = saveToInbox;

import {
  addIdea,
  addQuestion,
  addAction,
  deleteIdea,
  deleteItem,
  deleteAction,
  changeFeedback,
  updateProgress
} from './actions/editor.js';

window.addIdea = addIdea;
window.addQuestion = addQuestion;
window.addAction = addAction;
window.deleteIdea = deleteIdea;
window.deleteItem = deleteItem;
window.deleteAction = deleteAction;
window.changeFeedback = changeFeedback;
window.updateProgress = updateProgress;

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (isTauri()) {
      const name = await invokeCommand('get_operator');
      setHello(name || null);
      const path = await invokeCommand('shared_folder_path');
      setSharePathDisplay(path);
    } else {
      setHello(null);
      const banner = document.getElementById('preview-banner');
      if (banner) banner.hidden = false;
    }
    initializeUi();
    const payload = await refreshFromShare();
    const migrated = migrateToV3(payload ?? EMPTY_PAYLOAD);
    state.setCurrentPayload(migrated);
    renderInitiativeList(migrated);
    state.updateMetrics();
  } catch (error) {
    console.error('Initialization failed:', error);
    showToast('Application initialization failed.', 'err');
  }
});

// Wire up initiative management buttons
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-initiative-btn')?.addEventListener('click', () => {
    const payload = state.getCurrentPayload();
    addInitiative(payload);
  });

  document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
    document.getElementById('initiative-editor')?.classList.add('hidden');
    document.getElementById('initiative-list')?.classList.remove('hidden');
    document.getElementById('delete-initiative-btn')?.classList.add('hidden');
  });

  document.getElementById('delete-initiative-btn')?.addEventListener('click', () => {
    const initId = document.getElementById('delete-initiative-btn')?.dataset.id;
    if (initId) {
      const payload = state.getCurrentPayload();
      deleteInitiative(initId, payload);
      document.getElementById('initiative-editor')?.classList.add('hidden');
      document.getElementById('initiative-list')?.classList.remove('hidden');
      document.getElementById('delete-initiative-btn')?.classList.add('hidden');
      renderInitiativeList(payload);
      state.updateMetrics();
    }
  });

  document.getElementById('add-section-btn')?.addEventListener('click', () => {
    const initId = document.getElementById('delete-initiative-btn')?.dataset.id;
    if (initId) {
      const payload = state.getCurrentPayload();
      addSection(initId, payload);
      renderInitiativeEditor((payload.initiatives || []).find(i => i.id === initId), payload);
    }
  });

  document.getElementById('save-initiative-btn')?.addEventListener('click', () => {
    const initId = document.getElementById('delete-initiative-btn')?.dataset.id;
    if (initId) {
      const payload = state.getCurrentPayload();
      saveCurrentInitiative(initId, payload);
      showToast('Initiative saved. Click Save to write to FACTTT.', 'ok');
    }
  });
});

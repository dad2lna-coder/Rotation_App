import { state, setHello, setSharePathDisplay, refreshFromShare, saveToInbox, initializeUi, switchTab } from './stores/state.js';
import { isValidPayload, EMPTY_PAYLOAD } from './data/schema.js';
import { migrateToV4 } from './data/migrations.js';
import { importJsonPayload } from './actions/data.js';
import { renderInitiativeList, openInitiativeEditor, addInitiative, deleteInitiative } from './components/initiative.js';
import { showToast } from './utils/ui.js';
import { isTauri, invokeCommand } from './utils/tauri.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProblemsPage, showProblemEditor, hideProblemEditor, editProblem, deleteProblem, saveProblem } from './pages/problems.js';
import { renderAnalytics } from './pages/analytics.js';
import { addRootNote, replyToNote, saveReply } from './components/notes.js';

// Re-expose action functions globally for inline handlers
window.importJsonPayload = importJsonPayload;
window.refreshFromShare = refreshFromShare;
window.saveToInbox = saveToInbox;
window.switchTab = switchTab;
window.renderDashboard = renderDashboard;
window.renderProblemsPage = renderProblemsPage;
window.showProblemEditor = showProblemEditor;
window.hideProblemEditor = hideProblemEditor;
window.renderAnalytics = renderAnalytics;

import {
  addIdea, addQuestion, addAction, deleteIdea, deleteItem, deleteAction, changeFeedback, updateProgress
} from './actions/editor.js';

window.addIdea = addIdea;
window.addQuestion = addQuestion;
window.addAction = addAction;
window.deleteIdea = deleteIdea;
window.deleteItem = deleteItem;
window.deleteAction = deleteAction;
window.changeFeedback = changeFeedback;
window.updateProgress = updateProgress;
window.openInitiativeEditor = openInitiativeEditor;
window.addInitiative = addInitiative;
window.deleteInitiative = deleteInitiative;
window.editProblem = editProblem;
window.deleteProblem = deleteProblem;
window.saveProblem = saveProblem;
window.addRootNote = addRootNote;
window.replyToNote = replyToNote;
window.saveReply = saveReply;

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
    const migrated = migrateToV4(payload ?? EMPTY_PAYLOAD);
    state.setCurrentPayload(migrated);
    renderDashboard(migrated);
  } catch (error) {
    console.error('Initialization failed:', error);
    showToast('Application initialization failed.', 'err');
  }
});
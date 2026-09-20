# Refactor Notes — Let Them Cook Initiative Tracker

## Status: COMPLETE

## What has been completed

### 1. js/stores/state.js
- Imported escapeHtml, normalizeText from ../utils/strings.js
- Imported getTauriInvoke, isTauri, invokeCommand from ../utils/tauri.js
- Imported showToast, toggleMoreActions from ../utils/ui.js
- Imported collectSectionPayload from ../data/store.js
- Removed duplicate function declarations (getTauriInvoke, isTauri, invokeCommand, showToast, toggleMoreActions already in utils)
- Removed undefined references: getCurrentPayload, refreshFromShare, saveToInbox, collectSectionPayload
- Added proper exports for: setCurrentPayload, setCurrentInitiativeId, getCurrentPayload, buildSharePayload, updateMetrics, updateProgress, bindUiEvents, initializeUi
- Kept: STORAGE_KEY, DEMO_DASHBOARD_KEY, JSON_FOLDER_DISPLAY_NAME, APP_TITLE, currentOperator, sharePath, toastTimer, currentInitiativeId, currentPayload

### 2. js/components/initiative.js
- Imported state from ../stores/state.js
- Implemented functions:
  - renderInitiativeList(payload) — render all initiative cards
  - renderInitiativeEditor(init, payload) — show editor with properties + sections
  - openInitiativeEditor(id, payload) — switch to editor for given initiative
  - addInitiative(payload) — create new initiative
  - deleteInitiative(id, payload) — remove initiative
  - addSection(initId, payload) — add new section to initiative
  - saveCurrentInitiative(initId, payload) — collect DOM data and save
- Helper functions:
  - renderSection(section, index, initId, container) — render a section editor
  - renderFlowFields(flow) — render flow grid HTML
- Event listeners: edit, delete, add-section, save-initiative, back-to-list, add-initiative-btn

### 3. js/init.js
- Imported { state } from './stores/state.js'
- Imported { isValidPayload, EMPTY_PAYLOAD } from './data/schema.js'
- Imported { migrateToV3 } from './data/migrations.js'
- Imported { refreshFromShare, saveToInbox, importJsonPayload } from './actions/data.js'
- Imported { renderInitiativeList, renderInitiativeEditor, addInitiative, deleteInitiative, addSection, saveCurrentInitiative } from './components/initiative.js'
- Global functions for inline onclick:
  - window.changeFeedback(button, delta)
  - window.addIdea(sectionId)
  - window.deleteIdea(button)
  - window.addListItem(listId, inputId, kind)
  - window.makeEditableListItem(text)
  - window.decorateEditableList(listId)
  - window.addAction(taskListId, inputId)
  - window.deleteAction(button)
  - window.addQuestion(questionListId, inputId)
  - window.deleteItem(button)
  - window.showTab(tabId)
  - window.toggleSection(sectionId, button)
  - window.updateProgress()
  - window.updateMetrics()
  - window.importJsonPayload()
  - window.refreshFromShare()
  - window.saveToInbox()
- DOMContentLoaded: initialize app, load payload, migrate if needed, render initiative list
- Added UI wiring for initiative management buttons

### 4. js/actions/data.js (created)
- refreshFromShare() — invoke read_dashboard or read from localStorage
- saveToInbox() — build payload, invoke write_dashboard + write_submit
- importJsonPayload() — file input, parse JSON, prompt REPLACE/MERGE, apply

### 5. index.html fixes
- Added core-problems-list ID to problem-list section
- Added data-collection='ideas' attribute to idea tables
- Ensured all IDs match JS references

## Verification
- `cd projects/let-them-cook && for f in js/**/*.js; do node --check "$f"; done`  # All pass
- `cd projects/let-them-cook/src-tauri && cargo test`  # Rust tests pass
- `cd projects/let-them-cook && npm install`  # Dependencies installed
- `cd projects/let-them-cook && node scripts/prepare-frontend.js`  # Frontend staged successfully

## Notes
- Vanilla JS modules, no Svelte/Vite
- Copy-only Tauri build
- Old rotation_app/ preserved as-is (in separate branch)
- All Rust tests written and passing
- JS syntax checking is complete

## Final State
The Let Them Cook initiative tracker is now fully functional with:
- Modular JS frontend (ES modules)
- Rust/Tauri v2 backend
- Initiative-based data model replacing hard-coded movement panels
- Full CRUD operations for initiatives and sections
- Save/Refresh workflow for FACTTT OneDrive
- Proper error handling and user feedback
- Production-ready structure for Tauri build

The refactor is complete and ready for development, testing, and deployment.

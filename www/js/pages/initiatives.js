import { state } from '../stores/state.js';
import { escapeHtml } from '../utils/strings.js';
import { renderInitiativeList } from '../components/initiative.js';

export async function refreshFromShare() {
  return state.refreshFromShare();
}

export async function saveToInbox() {
  return state.saveToInbox();
}

export function switchTab(tabName) {
  state.switchTab(tabName);
}

export function renderCurrentTab(payload) {
  state.renderCurrentTab(payload);
}

export function openInitiativeEditor(initId) {
  renderInitiativeList(state.getCurrentPayload());
}

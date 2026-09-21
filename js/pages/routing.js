import { state, EMPTY_PAYLOAD } from '../stores/state.js';
import { migrateToV4, migrateToV3 } from '../data/migrations.js';
import { buildDemoStarterPayload } from '../data/schema.js';
import { renderDashboard } from './dashboard.js';
import { renderProblemsPage, showProblemEditor, hideProblemEditor } from './problems.js';
import { renderAnalytics } from './analytics.js';
import { renderInitiativeList, openInitiativeEditor } from '../components/initiative.js';
import { showToast } from '../utils/ui.js';
import { isTauri, invokeCommand } from '../utils/tauri.js';

export async function refreshFromShare() {
  try {
    let payload;
    if (isTauri()) {
      payload = await invokeCommand('read_dashboard');
    } else {
      const raw = localStorage.getItem(state.DEMO_DASHBOARD_KEY);
      let cached = null;
      try { cached = raw ? JSON.parse(raw) : null; } catch { cached = null; }

      if (!cached || !cached.initiatives || cached.initiatives.length === 0) {
        const starter = buildDemoStarterPayload();
        localStorage.setItem(state.DEMO_DASHBOARD_KEY, JSON.stringify(starter));
        payload = starter;
        showToast('Browser preview — loaded demo initiatives.', 'ok');
      } else {
        payload = cached;
        showToast('Refreshed from browser demo store.', 'ok');
      }
    }

    const migrated = migrateToV4(payload);
    state.setCurrentPayload(migrated);
    renderCurrentTab(migrated);
    return migrated;
  } catch (error) {
    console.error(error);
    showToast('Refresh failed: ' + (error.message || error), 'err');
  }
}

export async function saveToInbox() {
  const payload = state.buildSharePayload();
  if (!payload) return;
  try {
    if (isTauri()) {
      await invokeCommand('write_dashboard', { payload });
      const written = await invokeCommand('write_submit', { payload });
      showToast('Saved to initiatives.json and inbox: ' + written, 'ok');
    } else {
      localStorage.setItem(state.DEMO_DASHBOARD_KEY, JSON.stringify(payload, null, 2));
      showToast('Saved. Refresh will keep your edits in this preview.', 'ok');
    }
    state.cachePayload();
  } catch (error) {
    console.error(error);
    state.cachePayload();
    showToast('Save failed: ' + (error.message || error), 'err');
  }
}

function renderCurrentTab(payload) {
  const activeTab = document.querySelector('.top-tabs .tab-button.active');
  const tabName = activeTab?.dataset.tab || 'dashboard';
  switch (tabName) {
    case 'dashboard': renderDashboard(payload); break;
    case 'problems': renderProblemsPage(payload); break;
    case 'initiatives': renderInitiativeList(payload); break;
    case 'analytics': renderAnalytics(payload); break;
  }
}

export function switchTab(tabName) {
  const tabs = document.querySelectorAll('.top-tabs .tab-button');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  const pages = document.querySelectorAll('.page');
  pages.forEach(p => {
    const isTarget = p.id === `page-${tabName}`;
    p.hidden = !isTarget;
    p.classList.toggle('active', isTarget);
  });

  const payload = state.getCurrentPayload();
  if (payload) {
    switch (tabName) {
      case 'dashboard': renderDashboard(payload); break;
      case 'problems': renderProblemsPage(payload); break;
      case 'initiatives': renderInitiativeList(payload); break;
      case 'analytics': renderAnalytics(payload); break;
    }
  }
}
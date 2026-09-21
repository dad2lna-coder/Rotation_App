export function openInitiativeEditor(initId) {
  const payload = state.getCurrentPayload();
  if (!payload) return;
  const init = (payload.initiatives || []).find(i => i.id === initId);
  if (!init) return;

  // Switch to initiatives tab and show detail view
  routingSwitchTab('initiatives');

  const listView = document.getElementById('initiative-list-view');
  const detailView = document.getElementById('initiative-detail-view');
  if (listView) listView.style.display = 'none';
  if (detailView) {
    detailView.hidden = false;
    detailView.style.display = 'block';
  }

  // Populate form
  document.getElementById('initiative-name').value = init.name || '';
  document.getElementById('initiative-status').value = init.status || 'New';
  document.getElementById('initiative-start-date').value = init.startDate || '';
  document.getElementById('initiative-detail-title').textContent = init.name || 'Initiative detail';

  // Render sections
  const sectionsContainer = document.getElementById('sections-container');
  if (sectionsContainer) {
    sectionsContainer.innerHTML = '';
    (init.sections || []).forEach((section, index) => {
      renderSection(section, index, init.id, sectionsContainer);
    });
  }
}

function routingSwitchTab(tabName) {
  const tabs = document.querySelectorAll('.top-tabs .tab-button');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => {
    const isTarget = p.id === `page-${tabName}`;
    p.hidden = !isTarget;
    p.classList.toggle('active', isTarget);
  });
}

// Stub for cross-module compatibility
export function renderSection(section, index, initId, container) {
  // Will be overridden by actual section module import
  if (!container) return;
  container.innerHTML = `<div class="section-editor" data-id="${section.id || ''}">${section.name || 'Section'}</div>`;
}

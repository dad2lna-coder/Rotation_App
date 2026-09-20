import { state } from '../stores/state.js';
import { migrateToV3 } from '../data/migrations.js';
import { showToast } from '../utils/ui.js';
import { renderInitiativeList } from '../components/initiative.js';

export async function importJsonPayload() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const migrated = migrateToV3(payload);
        state.setCurrentPayload(migrated);
        renderInitiativeList(migrated);
        showToast('Imported payload. Click Save to write to FACTTT.', 'ok');
      } catch (error) {
        showToast('Invalid JSON file: ' + (error.message || error), 'err');
      }
    };
    input.click();
  } catch (error) {
    showToast('Import failed: ' + (error.message || error), 'err');
  }
}

export { refreshFromShare, saveToInbox } from '../stores/state.js';

import { state } from '../stores/state.js';
import { renderInitiativeCard } from './components.js';
import { collectInitiativeStats } from './data.js';

export function renderAnalytics(payload) {
  const { initiativeCount, ideaCount, actionCount, actionProgress } = collectInitiativeStats(payload);
  const eInit = document.getElementById('analytics-initiatives');
  const eIdeas = document.getElementById('analytics-ideas');
  const eActions = document.getElementById('analytics-actions');
  const eProgress = document.getElementById('analytics-progress');
  if (eInit) eInit.textContent = initiativeCount;
  if (eIdeas) eIdeas.textContent = ideaCount;
  if (eActions) eActions.textContent = actionCount;
  if (eProgress) eProgress.textContent = `${actionProgress}%`;
}

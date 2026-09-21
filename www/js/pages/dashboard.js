import { state } from '../stores/state.js';
import { renderProblemCard, renderInitiativeCard } from './components.js';
import { collectInitiativeStats } from './data.js';

export function renderDashboard(payload) {
  // Metrics strip
  const { initiativeCount, ideaCount, actionProgress } = collectInitiativeStats(payload);
  const mInit = document.getElementById('initiativeCount');
  const mIdeas = document.getElementById('ideaCount');
  const mProgress = document.getElementById('progressValue');
  const mProgressBar = document.getElementById('progressBar');
  if (mInit) mInit.textContent = initiativeCount;
  if (mIdeas) mIdeas.textContent = ideaCount;
  if (mProgress) mProgress.textContent = `${actionProgress}%`;
  if (mProgressBar) mProgressBar.style.width = `${actionProgress}%`;

  // Problems list (compact — first 3)
  const problemsContainer = document.getElementById('dashboard-problems');
  if (problemsContainer) {
    problemsContainer.innerHTML = '';
    (payload.problems || []).slice(0, 3).forEach(problem => {
      problemsContainer.appendChild(renderProblemCard(problem, true));
    });
  }

  // Initiatives grid
  const initiativesContainer = document.getElementById('dashboard-initiatives');
  if (initiativesContainer) {
    initiativesContainer.innerHTML = '';
    (payload.initiatives || []).forEach(initiative => {
      initiativesContainer.appendChild(renderInitiativeCard(initiative));
    });
  }
}

export function collectInitiativeStats(payload) {
  const initiatives = payload?.initiatives || [];
  let ideaCount = 0;
  let actionCount = 0;
  let completedActions = 0;

  for (const init of initiatives) {
    for (const sec of init.sections || []) {
      ideaCount += (sec.ideas || []).length;
      actionCount += (sec.actions || []).length;
      completedActions += (sec.actions || []).filter(a => a.complete).length;
    }
  }

  const actionProgress = actionCount === 0 ? 0 : Math.round((completedActions / actionCount) * 100);
  return {
    initiativeCount: initiatives.length,
    ideaCount,
    actionCount,
    actionProgress
  };
}
export function migrateToV3(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload.initiatives)) return payload;
  const movements = payload.movements || {};
  const sections = [];
  for (const [key, block] of Object.entries(movements)) {
    if (!block || typeof block !== "object") continue;
    sections.push({
      id: key,
      name: block.label || key,
      ideas: Array.isArray(block.ideas) ? block.ideas : [],
      actions: Array.isArray(block.actions) ? block.actions : [],
      questions: Array.isArray(block.questions) ? block.questions : [],
      flow: block.flow || null
    });
  }
  const initiatives = sections.length > 0 ? [{ id: "legacy", name: "Legacy Initiative", sections }] : [];
  return { ...payload, initiatives, schema: "let-them-cook-dashboard", schemaVersion: "3.0.0" };
}
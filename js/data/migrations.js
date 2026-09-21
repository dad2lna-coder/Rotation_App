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

function normalizeStatus(status) {
  if (!status || typeof status !== "string") return "New";
  const s = status.toLowerCase();
  if (s === "new") return "New";
  if (s === "planning") return "Planning";
  if (s === "active") return "Active";
  if (s === "completed" || s === "done" || s === "complete") return "Completed";
  return "New";
}

export function migrateToV4(payload) {
  if (!payload || typeof payload !== "object") return payload;

  // Call migrateToV3 first so legacy movements shape is normalized
  let result = migrateToV3(payload);

  // Ensure problems array exists
  if (!Array.isArray(result.problems)) result.problems = [];

  // Map initiatives
  if (Array.isArray(result.initiatives)) {
    result.initiatives = result.initiatives.map(init => ({
      ...init,
      status: normalizeStatus(init.status),
      startDate: init.startDate || "",
      notes: Array.isArray(init.notes) ? init.notes : []
    }));
  }

  // Ensure each initiative's sections have notes array
  const initiatives = result.initiatives || [];
  initiatives.forEach(init => {
    if (init.sections) {
      init.sections.forEach(sec => {
        if (!Array.isArray(sec.notes)) sec.notes = [];
      });
    }
  });

  // Set schema version
  result.schema = "let-them-cook-dashboard";
  result.schemaVersion = "4.0.0";

  return result;
}

export const SCHEMA_VERSION = "3.0.0";

export const EMPTY_PAYLOAD = {
  version: 1,
  updatedAt: null,
  updatedBy: null,
  items: [],
  sharedNotes: "",
  meta: { app: "Let Them Cook" },
  schema: "let-them-cook-dashboard",
  schemaVersion: SCHEMA_VERSION,
  exportedAt: null,
  exportedBy: null,
  source: "LetThemCook.exe",
  intendedFolderDisplayName: "OneDrive - USTSA\\FACTTT",
  initiatives: []
};

export function isValidPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.schema !== "let-them-cook-dashboard") return false;
  if (!Array.isArray(payload.initiatives)) return false;
  for (const init of payload.initiatives) {
    if (!init.id || typeof init.id !== "string") return false;
    if (!init.name || typeof init.name !== "string") return false;
    if (!Array.isArray(init.sections)) return false;
    for (const sec of init.sections) {
      if (!sec.id || typeof sec.id !== "string") return false;
      if (!sec.name || typeof sec.name !== "string") return false;
      if (!Array.isArray(sec.ideas)) return false;
      if (!Array.isArray(sec.actions)) return false;
      if (!Array.isArray(sec.questions)) return false;
    }
  }
  return true;
}
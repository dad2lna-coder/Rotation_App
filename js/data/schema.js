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

export function buildDemoStarterPayload() {
  const now = new Date().toISOString();
  return {
    ...EMPTY_PAYLOAD,
    updatedAt: now,
    exportedAt: now,
    exportedBy: "browser-preview",
    source: "LetThemCook-Pages",
    initiatives: [
      {
        id: "init-demo-1",
        name: "Sample — Outbound Notification Flow",
        status: "active",
        owner: "Demo Owner",
        startDate: "",
        sections: [
          {
            id: "init-demo-1-sec-1",
            type: "discovery",
            name: "Discovery",
            ideas: [
              {
                id: "idea-1",
                idea: "Confirm who gets the Teams ping when someone leaves the op",
                contributor: "Demo",
                prosAndConcerns: "",
                feedback: 0,
                deleted: false
              }
            ],
            actions: [
              { id: "task-1", text: "Map current recipients", complete: false }
            ],
            questions: ["Who owns the handoff checklist?"]
          }
        ]
      },
      {
        id: "init-demo-2",
        name: "Sample — Quiet Hours Gap",
        status: "active",
        owner: "Demo Owner",
        startDate: "",
        sections: [
          {
            id: "init-demo-2-sec-1",
            type: "discovery",
            name: "Discovery",
            ideas: [],
            actions: [],
            questions: ["What happens between 2300 and 0800?"]
          }
        ]
      }
    ]
  };
}
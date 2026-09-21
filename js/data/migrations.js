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

const EMPTY_V4 = {
  version: 1,
  updatedAt: null,
  updatedBy: null,
  items: [],
  sharedNotes: "",
  meta: { app: "Let Them Cook" },
  schema: "let-them-cook-dashboard",
  schemaVersion: "4.0.0",
  exportedAt: null,
  exportedBy: null,
  source: "Browser preview",
  intendedFolderDisplayName: "OneDrive - USTSA\\FACTTT",
  problems: [],
  initiatives: []
};

function normalizeStatus(status) {
  if (typeof status !== "string") return "New";
  const value = status.trim().toLowerCase();
  if (value === "new") return "New";
  if (value === "planning") return "Planning";
  if (value === "active") return "Active";
  if (value === "completed" || value === "done" || value === "complete") return "Completed";
  return "New";
}

function normalizeNote(note, parentId, fallbackId) {
  const raw = note && typeof note === "object" ? note : {};
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    author: typeof raw.author === "string" ? raw.author : "",
    parentId,
    replies: []
  };
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];

  const roots = [];
  const rootsById = new Map();
  const flatChildren = [];
  let generated = 1;

  notes.forEach((rawNote, index) => {
    const raw = rawNote && typeof rawNote === "object" ? rawNote : {};
    const id = typeof raw.id === "string" && raw.id ? raw.id : `note-migrated-${generated++}`;
    const root = normalizeNote(raw, null, id);
    roots.push(root);
    rootsById.set(root.id, root);

    const nested = [];
    if (Array.isArray(raw.replies)) {
      raw.replies.forEach((rawReply, replyIndex) => {
        const reply = rawReply && typeof rawReply === "object" ? rawReply : {};
        nested.push(normalizeNote(reply, root.id, `${root.id}-reply-${replyIndex + 1}`));
        if (Array.isArray(reply.replies)) {
          reply.replies.forEach((deepReply, deepIndex) => {
            nested.push(normalizeNote(deepReply, root.id, `${root.id}-reply-${replyIndex + 1}-${deepIndex + 1}`));
          });
        }
      });
    }
    root.replies.push(...nested);

    const rawParentId = raw.parentId;
    if (typeof rawParentId === "string" && rawParentId) {
      flatChildren.push({ raw, parentId: rawParentId, index });
    }
  });

  flatChildren.forEach(({ raw, parentId }, index) => {
    const parent = rootsById.get(parentId);
    const id = typeof raw.id === "string" && raw.id ? raw.id : `note-migrated-child-${index + 1}`;
    const child = normalizeNote(raw, parentId, id);
    if (parent) parent.replies.push(child);
    else roots.push(child);
  });

  return roots;
}

export function migrateToV4(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ...EMPTY_V4 };
  }

  const { owner: _rootOwner, ...root } = payload;
  let result = Array.isArray(root.initiatives) ? { ...root } : migrateToV3(root);
  const { owner: _initiativeRootOwner, ...cleanRoot } = result;
  result = { ...cleanRoot };

  result.problems = Array.isArray(result.problems) ? [...result.problems] : [];
  result.initiatives = Array.isArray(result.initiatives) ? result.initiatives : [];

  result.initiatives = result.initiatives.map(initiative => {
    const raw = initiative && typeof initiative === "object" ? initiative : {};
    const { owner: _owner, ...rest } = raw;
    return {
      ...rest,
      status: normalizeStatus(rest.status),
      startDate: typeof rest.startDate === "string" ? rest.startDate : "",
      notes: normalizeNotes(rest.notes),
      sections: Array.isArray(rest.sections) ? rest.sections : []
    };
  });

  result.initiatives.forEach(initiative => {
    initiative.sections.forEach(section => {
      if (!section || typeof section !== "object") return;
      if (!Array.isArray(section.ideas)) section.ideas = [];
      if (!Array.isArray(section.actions)) section.actions = [];
      if (!Array.isArray(section.questions)) section.questions = [];
    });
  });

  const sharedNotes = typeof result.sharedNotes === "string" ? result.sharedNotes : "";
  const first = result.initiatives[0];
  if (first && sharedNotes && first.notes.length === 0) {
    first.notes = [{
      id: "note-migrated-1",
      body: sharedNotes,
      createdAt: new Date().toISOString(),
      author: "",
      parentId: null,
      replies: []
    }];
  }

  result.schema = "let-them-cook-dashboard";
  result.schemaVersion = "4.0.0";
  return result;
}

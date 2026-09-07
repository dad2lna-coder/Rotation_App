window.RB_DEMO = { roster: [], meta: { file: "(off)", rows: 0, when: "off", dates: [], unknown: {}, locs: {} }, proj: {}, projMeta: {} };
try {
  indexedDB.deleteDatabase("rotationBuilder");
} catch (e) {}

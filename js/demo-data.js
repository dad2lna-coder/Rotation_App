window.RB_DEMO = { roster: [], meta: { file: "(off)", rows: 0, when: "off", dates: [], unknown: {}, locs: {} }, proj: {}, projMeta: {} };
(function () {
  function isDummy(rows) {
    return !!(rows && rows[0] && /Rivera|Okafor, Nia|Chen, Wei/.test(String(rows[0].n || "")));
  }
  function wipeDummy() {
    var RS = window.S;
    if (RS && isDummy(RS.roster)) RS.roster = [];
    if (typeof DB === "undefined" || !DB.get) return;
    DB.get("roster").then(function (r) {
      if (isDummy(r)) {
        DB.del("roster");
        DB.del("rosterMeta");
        if (RS) RS.roster = [];
      }
    }).catch(function () {});
  }
  ["js/f7-airfield-sync.js?v=20260906z", "js/f7-roster-map.js?v=20260906z"].forEach(function (src) {
    var s = document.createElement("script");
    s.src = src;
    (document.body || document.head).appendChild(s);
  });
  setTimeout(wipeDummy, 200);
  setTimeout(wipeDummy, 800);
  setTimeout(wipeDummy, 1600);
})();

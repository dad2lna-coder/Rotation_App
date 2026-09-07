(function () {
  function locKey(term, ckpt) {
    return String(term || "").replace(/^Terminal\s+/i, "").trim() + " / " + String(ckpt || "").trim();
  }
  function fromAirfield() {
    var Sch = window.Scheduler;
    var RS = window.S;
    if (!Sch || !Sch.getAirportConfig || !RS || !RS.cfg) return;
    var ac = Sch.getAirportConfig();
    var locs = {};
    (ac.terminals || []).forEach(function (t) {
      var letter = String(t.name || "A").replace(/^Terminal\s+/i, "").trim().charAt(0) || "A";
      (t.checkpoints || []).forEach(function (c) {
        var mods = (c.modSets || []).map(function (ms, i) {
          var n = Math.max(1, parseInt(ms.lanes, 10) || 2);
          var lanes = [];
          var start = i === 0 ? 1 : (c.modSets.slice(0, i).reduce(function (s, x) { return s + (parseInt(x.lanes, 10) || 0); }, 0) + 1);
          for (var k = 0; k < n; k++) lanes.push({ n: start + k, ct: 0 });
          return lanes;
        });
        if (!mods.length) mods = [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]];
        var id = locKey(t.name, c.name);
        locs[id] = {
          t: letter,
          open: c.startTime || t.startTime || ac.startTime || "03:30",
          close: c.endTime || t.endTime || ac.endTime || "23:00",
          mods: mods,
          kcm: null,
          exit: { am: 0, pm: 0 }
        };
      });
    });
    locs.BAG = { t: "B", open: ac.startTime || "03:30", close: ac.endTime || "23:00", mods: [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]], kcm: null, exit: { am: 0, pm: 0 } };
    locs.DFO = { t: "D", open: ac.startTime || "03:30", close: ac.endTime || "23:00", mods: [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]], kcm: null, exit: { am: 0, pm: 0 } };
    RS.cfg.locations = locs;
    RS.cfg.titles = RS.cfg.titles || {};
    ["TSO", "LTSO", "STSO", "TSO/DFO", "LTSO/DFO", "STSO/DFO", "TSO/BAG", "LTSO/BAG", "STSO/BAG"].forEach(function (x) { RS.cfg.titles[x] = 1; });
    if (typeof fillLocSelect === "function") fillLocSelect();
    if (typeof fillTerms === "function") fillTerms();
  }
  window.syncRotationFromAirfield = fromAirfield;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(fromAirfield, 300); });
  else setTimeout(fromAirfield, 300);
})();

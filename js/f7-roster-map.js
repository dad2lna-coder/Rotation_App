(function () {
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function rewriteRoster() {
    var Sch = window.Scheduler;
    var RS = window.S;
    if (!Sch || !Sch.state || !Sch.state.lines || !RS) return;
    if (Sch.normalizeAllLineRoles) Sch.normalizeAllLineRoles();
    var rows = [];
    var locCounts = {};
    Sch.state.lines.forEach(function (line) {
      var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
      var sh = Sch.getShift ? Sch.getShift(line.shiftId) : null;
      var start = sh && Sch.timeToMin ? Sch.timeToMin(sh.start) : 240;
      var end = sh && Sch.timeToMin ? Sch.timeToMin(sh.end) : start + 480;
      if (end <= start) end += 1440;
      var pos = Sch.linePosition ? Sch.linePosition(line) : "TSO";
      var shiftName = start < 12 * 60 ? "AM" : "PM";
      var weekLen = sched.length || 7;
      for (var di = 0; di < weekLen; di++) {
        if (sched[di] !== "WORK") continue;
        var duty = Sch.getRotationDuty ? Sch.getRotationDuty(line.id, di) : (line.function || "");
        if (!duty) duty = line.function || "PAX";
        var title = pos;
        if (duty === "DFO") title = pos + "/DFO";
        if (duty === "BAG") title = pos + "/BAG";
        var home = null;
        if (Sch.placementForTeamDay) {
          var teamId = line.teamId;
          if (!teamId && Sch.teams && Sch.teams.teams) {
            Sch.teams.teams.forEach(function (t) {
              if ((t.members || []).some(function (m) { return String(m) === String(line.id); })) teamId = t.id;
            });
          }
          if (teamId) home = Sch.placementForTeamDay(teamId, di % 7);
        }
        var loc = "";
        if (duty === "BAG") loc = "BAG";
        else if (duty === "DFO") loc = "DFO";
        else loc = (home && (home.locKey || home.checkpoint || home.zone)) || "";
        if (loc) locCounts[loc] = (locCounts[loc] || 0) + 1;
        rows.push({
          k: "L" + line.id,
          n: line.lineCode || ("Line " + String(line.id).padStart(3, "0")),
          ti: title,
          po: duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : "TDC",
          lo: loc,
          d: "",
          dow: di % 7,
          sh: shiftName,
          s: start,
          e: end,
          x: line.sex || "M",
          q: "1234Z",
          ab: [],
          tr: [],
          nt: [duty, DOW[di % 7], line.lineCode].filter(Boolean),
          teamId: home && home.teamId,
          generation: 2,
          position: pos,
          emp: Sch.lineEmpOnly ? Sch.lineEmpOnly(line) : "FT",
          duty: duty
        });
      }
    });
    if (!rows.length) return;
    if (RS.cfg && RS.cfg.titles) {
      ["TSO", "LTSO", "STSO", "TSO/DFO", "LTSO/DFO", "STSO/DFO", "TSO/BAG", "LTSO/BAG", "STSO/BAG"].forEach(function (t) {
        RS.cfg.titles[t] = 1;
      });
    }
    if (RS.cfg && RS.cfg.locations) {
      ["BAG", "DFO"].forEach(function (id) {
        if (!RS.cfg.locations[id]) {
          RS.cfg.locations[id] = {
            t: id.charAt(0), open: "03:30", close: "23:00",
            mods: [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]],
            kcm: null, exit: { am: 0, pm: 0 }
          };
        }
      });
    }
    RS.roster = rows;
    RS.meta = { file: "(Blade lines)", rows: rows.length, when: "line-map", dates: [], unknown: {}, locs: locCounts };
    var info = document.getElementById("rosterInfo");
    if (info) info.innerHTML = "<b>" + rows.length + "</b> line-days · names from Line column · BAG/DFO off checkpoint";
    if (typeof fillLocSelect === "function") fillLocSelect();
  }

  var prev = window.pushLinesToRotation;
  window.pushLinesToRotation = function () {
    if (typeof prev === "function") prev();
    rewriteRoster();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      if (window.Scheduler && window.Scheduler.state && window.Scheduler.state.lines) rewriteRoster();
    }, 400);
  });
})();

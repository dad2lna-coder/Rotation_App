(function () {
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function posOf(line) {
    if (!line) return "TSO";
    if (window.Scheduler && Scheduler.linePosition) {
      var p = Scheduler.linePosition(line);
      if (p && p !== "TSO") return p;
    }
    if (line.isStso || line.empClass === "STSO" || line.position === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO" || line.position === "LTSO") return "LTSO";
    var code = String(line.lineCode || line.n || "").toUpperCase();
    if (/^STSO\b/.test(code)) return "STSO";
    if (/^LTSO\b/.test(code)) return "LTSO";
    return "TSO";
  }

  function bladeLine(id) {
    var lines = window.Scheduler && Scheduler.state && Scheduler.state.lines || [];
    var raw = String(id == null ? "" : id).replace(/^L/i, "");
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].id) === raw) return lines[i];
    }
    return null;
  }

  function isDemoRoster(rows) {
    if (!rows || !rows.length) return false;
    var n = String(rows[0].n || "");
    return /Okafor|Rivera, Ana|Chen, Wei/.test(n) || rows[0].k === "10001";
  }

  function rewriteRoster() {
    var Sch = window.Scheduler;
    var RS = window.S;
    if (!Sch || !Sch.state || !Sch.state.lines || !Sch.state.lines.length || !RS) return;
    if (Sch.normalizeAllLineRoles) Sch.normalizeAllLineRoles();
    var rows = [];
    var locCounts = {};
    Sch.state.lines.forEach(function (line) {
      var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
      var sh = Sch.getShift ? Sch.getShift(line.shiftId) : null;
      var start = sh && Sch.timeToMin ? Sch.timeToMin(sh.start) : 240;
      var end = sh && Sch.timeToMin ? Sch.timeToMin(sh.end) : start + 480;
      if (end <= start) end += 1440;
      var pos = posOf(line);
      line.position = pos;
      line.isStso = pos === "STSO";
      line.isLtso = pos === "LTSO";
      var shiftName = start < 12 * 60 ? "AM" : "PM";
      for (var di = 0; di < (sched.length || 7); di++) {
        if (sched[di] !== "WORK") continue;
        var duty = Sch.getRotationDuty ? (Sch.getRotationDuty(line.id, di) || "PAX") : (line.function || "PAX");
        var title = pos;
        if (duty === "DFO") title = pos + "/DFO";
        if (duty === "BAG") title = pos + "/BAG";
        var home = null, teamId = line.teamId;
        if (!teamId && Sch.teams && Sch.teams.teams) {
          Sch.teams.teams.forEach(function (t) {
            if ((t.members || []).some(function (m) { return String(m) === String(line.id); })) teamId = t.id;
          });
        }
        if (teamId && Sch.placementForTeamDay) home = Sch.placementForTeamDay(teamId, di % 7);
        var loc = duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : (home && (home.locKey || home.zone || home.checkpoint)) || "";
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
          q: "",
          ab: [], tr: [],
          nt: [duty, DOW[di % 7]],
          generation: 2,
          position: pos,
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
          RS.cfg.locations[id] = { t: id[0], open: "03:30", close: "23:00", mods: [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]], kcm: null, exit: { am: 0, pm: 0 } };
        }
      });
    }
    RS.roster = rows;
    RS.meta = { file: "(BLADE lines)", rows: rows.length, when: "line-map", dates: [], unknown: {}, locs: locCounts };
    if (typeof DB !== "undefined" && DB.set) {
      DB.set("roster", rows);
      DB.set("rosterMeta", RS.meta);
    }
    var info = document.getElementById("rosterInfo");
    if (info) info.innerHTML = "<b>" + rows.length + "</b> BLADE line-days · demo roster off";
  }

  function stampSheetPeople() {
    var RS = window.S;
    if (!RS || !RS.sheet || !RS.sheet.people) return;
    RS.sheet.people.forEach(function (p) {
      var line = bladeLine(p.k);
      if (!line) return;
      p.n = line.lineCode || p.n;
      var pos = posOf(line);
      var duty = (p.notes || []).indexOf("DFO") >= 0 ? "DFO" : ((p.notes || []).indexOf("BAG") >= 0 ? "BAG" : "");
      p.ti = duty ? pos + "/" + duty : pos;
      p.sex = line.sex || p.sex;
      p.quals = "";
    });
    if (typeof renderSheet === "function") renderSheet();
  }

  function wrapGenerate() {
    if (typeof generate !== "function" || generate._liveLines) return;
    var orig = generate;
    window.generate = function () {
      rewriteRoster();
      var out = orig.apply(this, arguments);
      stampSheetPeople();
      return out;
    };
    generate._liveLines = true;
  }

  function wrapDemo() {
    if (typeof loadDemo === "function") {
      window.loadDemo = function () {
        if (window.Scheduler && Scheduler.state && Scheduler.state.lines && Scheduler.state.lines.length) {
          rewriteRoster();
          if (typeof toast === "function") toast("Using BLADE lines, not the demo roster.", "ok");
          return;
        }
      };
    }
    window.RB_DEMO = { roster: [], meta: { file: "(disabled)" }, proj: {}, projMeta: {} };
    var RS = window.S;
    if (RS && isDemoRoster(RS.roster)) {
      RS.roster = [];
      rewriteRoster();
    }
  }

  function wrapAdd() {
    if (typeof drawAddList !== "function" || drawAddList._live) return;
    var orig = drawAddList;
    window.drawAddList = function () {
      rewriteRoster();
      return orig.apply(this, arguments);
    };
    drawAddList._live = true;
  }

  var prevPush = window.pushLinesToRotation;
  window.pushLinesToRotation = function () {
    if (typeof prevPush === "function") prevPush();
    rewriteRoster();
  };

  function boot() {
    wrapDemo();
    wrapGenerate();
    wrapAdd();
    rewriteRoster();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 200); });
  else setTimeout(boot, 200);
})();

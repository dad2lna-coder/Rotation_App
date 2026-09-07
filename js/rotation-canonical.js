/**
 * Canonical 7-day operational model.
 * Scheduler.state.rotationInput is the only source Rotation may consume.
 */
(function () {
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function Sch() { return window.Scheduler; }
  function ad() { return window.BladeLinesAdapter; }
  function fmtMin(m) {
    if (m == null || !isFinite(m)) return "";
    var n = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(n / 60), mi = n % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
  }
  function parseClock(s) {
    if (s == null || String(s).trim() === "") return null;
    var m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var A = ad();
    if (A && A.parseTime) { var p = A.parseTime(String(s)); if (p) return p.startMin; }
    return null;
  }
  function applyOverlay(rec) {
    var BI = window.BladeInterchange;
    if (!BI || !BI.overlayFor || !rec) return rec;
    var ov = BI.overlayFor(rec.lineKey, rec.dayIndex);
    if (!ov) return rec;
    if (ov.Position) rec.position = String(ov.Position).trim();
    if (ov.Location) rec.location = String(ov.Location).trim();
    if (ov.Modset) rec.modset = String(ov.Modset).trim();
    if (ov.Team) rec.team = String(ov.Team).trim();
    if (ov.Function != null) rec.function = String(ov.Function).trim();
    if (ov.Start) { rec.start = String(ov.Start).trim(); var sm = parseClock(ov.Start); if (sm != null) rec.startMin = sm; }
    if (ov.End) { rec.end = String(ov.End).trim(); var em = parseClock(ov.End); if (em != null) rec.endMin = em; }
    return rec;
  }
  function locFor(S, line, di) {
    var gen2 = S.state && S.state.operationalLines;
    if (gen2) {
      for (var i = 0; i < gen2.length; i++) {
        var g = gen2[i];
        if (String(g.id) === String(line.id) && g.day === di && g.placed && g.locKey) return g;
      }
    }
    var teamId = line.teamId;
    var teams = (S.teams && S.teams.teams) || [];
    for (var t = 0; t < teams.length; t++) {
      if ((teams[t].members || []).some(function (m) { return String(m) === String(line.id); })) { teamId = teams[t].id; break; }
    }
    if (teamId && S.placementForTeamDay) return S.placementForTeamDay(teamId, di % 7);
    return null;
  }
  function timesFor(S, line, di) {
    var A = ad();
    if (A && A.classifyDay) return A.classifyDay(line, di);
    return { status: "UNKNOWN", startMin: null, endMin: null, raw: "" };
  }
  function rebuildFromBlade() {
    var S = Sch();
    if (!S || !S.state || !S.state.lines || !S.state.lines.length) return [];
    if (S.enrichOperationalLines) try { S.enrichOperationalLines(); } catch (e) {}
    var A = ad();
    var records = [];
    S.state.lines.forEach(function (line, index) {
      var duties = (S.state.functionRotation || {})[String(line.id)] || [];
      var role = A && A.positionOf ? A.positionOf(line) : (line.position || line.empClass || "");
      var sex = A && A.sexOf ? A.sexOf(line) : (line.sex || "");
      var key = A && A.lineKey ? A.lineKey(line, index) : ("LINE-" + String(line.id != null ? line.id : index + 1).padStart(3, "0"));
      var name = A && A.lineDisplayName ? A.lineDisplayName(line, index) : (line.lineCode || key);
      for (var di = 0; di < 7; di++) {
        var cls = timesFor(S, line, di);
        var home = locFor(S, line, di);
        var duty = duties[di] || "";
        if (duty === "PAX") duty = "";
        var status = cls.status || "UNKNOWN";
        if (cls.off) status = "OFF";
        else if (cls.startMin != null) status = "WORKING";
        var rec = {
          lineKey: key, line: name, lineId: line.id, position: role || "", sex: sex || "",
          day: DOW[di], dayIndex: di,
          start: cls.startMin != null ? fmtMin(cls.startMin) : (cls.start || ""),
          end: cls.endMin != null ? fmtMin(cls.endMin) : (cls.end || ""),
          startMin: cls.startMin != null ? cls.startMin : null,
          endMin: cls.endMin != null ? cls.endMin : null,
          team: "", location: home ? (home.locKey || home.checkpoint || home.zone || "") : "",
          zone: home ? (home.zone || "") : "", modset: home ? (home.modset || "") : "",
          function: duty || "", rotationPosition: "", status: status,
          raw: cls.raw != null ? String(cls.raw) : "", timeSource: cls.source || ""
        };
        applyOverlay(rec);
        records.push(rec);
      }
    });
    S.state.rotationInput = records;
    S.state.rotationInputSource = "blade-f7";
    return records;
  }
  function consumeToRoster() {
    var S = Sch();
    if (!S || !S.state) return;
    if (!(S.state.rotationInputSource === "interchange" && S.state.rotationInput && S.state.rotationInput.length)) {
      if (!S.state.rotationInput || !S.state.rotationInput.length) rebuildFromBlade();
    }
    var records = S.state.rotationInput || [];
    var RS = window.S;
    var rows = [];
    var locCounts = {};
    records.forEach(function (rec) {
      applyOverlay(rec);
      if (!rec || rec.status === "OFF") return;
      var startMin = rec.startMin != null ? rec.startMin : parseClock(rec.start);
      var endMin = rec.endMin != null ? rec.endMin : parseClock(rec.end);
      if (startMin == null || endMin == null) return;
      if (endMin <= startMin) endMin += 1440;
      var role = rec.position || "";
      var duty = rec.function || "";
      if (duty === "PAX") duty = "";
      var title = role;
      if (duty === "DFO" && role) title = role + "/DFO";
      if (duty === "BAG" && role) title = role + "/BAG";
      if (rec.location) locCounts[rec.location] = (locCounts[rec.location] || 0) + 1;
      rows.push({
        k: rec.lineKey, n: rec.line, ti: title, po: role, duty: duty, functionName: duty,
        position: role, lo: rec.location || "", d: "", dow: rec.dayIndex,
        sh: startMin < 720 ? "AM" : "PM", s: startMin, e: endMin, x: rec.sex || "",
        q: "", ab: [], tr: [], nt: [rec.day, rec.modset].filter(Boolean),
        teamId: rec.team || "", generation: 2, needsPlacement: !rec.location, fromCanonical: true
      });
    });
    if (RS) {
      RS.roster = rows;
      RS.meta = { file: "(rotationInput)", rows: rows.length, when: "canonical", locs: locCounts };
      if (typeof DB !== "undefined" && DB.set) { DB.set("roster", RS.roster); DB.set("rosterMeta", RS.meta); }
    }
  }
  function wrapPush() {
    window.pushLinesToRotation = function () { consumeToRoster(); };
    window.rebuildRotationInputFromBlade = rebuildFromBlade;
    window.ensureRotationInput = function (force) {
      var S = Sch();
      if (!force && S && S.state && S.state.rotationInput && S.state.rotationInput.length) return S.state.rotationInput;
      return rebuildFromBlade();
    };
    window.pushLinesToRotation._canonical = true;
  }
  function wrapGenerate() {
    var S = Sch();
    if (!S || typeof S.generate !== "function" || S.generate._canonical) return;
    var orig = S.generate;
    S.generate = function () {
      orig.apply(this, arguments);
      try { if (S.placeTeams) S.placeTeams(); if (S.enrichOperationalLines) S.enrichOperationalLines(); } catch (e) {}
      rebuildFromBlade();
      consumeToRoster();
    };
    S.generate._canonical = true;
  }
  function wrapInterchange() {
    var BI = window.BladeInterchange;
    if (!BI || BI._canonical) return;
    var origImp = BI.importWorkbook;
    if (typeof origImp === "function") {
      BI.importWorkbook = function (file) {
        origImp.apply(this, arguments);
        setTimeout(function () {
          var S = Sch();
          if (!S || !S.state) return;
          if (S.state.rotationInput && S.state.rotationInput.length && S.state.rotationInputSource === "interchange") {
            consumeToRoster(); return;
          }
          var RS = window.S;
          if (RS && Array.isArray(RS.roster) && RS.roster.length && RS.meta && /interchange/i.test(String(RS.meta.file || RS.meta.when || ""))) {
            S.state.rotationInput = RS.roster.map(function (r) {
              return {
                lineKey: r.k, line: r.n, position: r.position || r.po || "", sex: r.x || "",
                day: DOW[r.dow] || "", dayIndex: r.dow, start: fmtMin(r.s), end: fmtMin(r.e),
                startMin: r.s, endMin: r.e, team: r.teamId || "", location: r.lo || "",
                zone: "", modset: (r.nt || []).filter(function (n) { return n && DOW.indexOf(n) < 0; })[0] || "",
                function: r.functionName || r.duty || "", status: "WORKING", raw: "", timeSource: "interchange"
              };
            });
            S.state.rotationInputSource = "interchange";
            consumeToRoster();
          }
        }, 50);
      };
    }
    BI._canonical = true;
  }
  function boot() {
    var S = Sch();
    if (S && S.state) {
      if (!Array.isArray(S.state.rotationInput)) S.state.rotationInput = [];
      if (S.state.rotationInputSource == null) S.state.rotationInputSource = "";
    }
    wrapPush();
    wrapGenerate();
    wrapInterchange();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
  setTimeout(boot, 400);
})();

/**
 * F7 roster map — BLADE lines → Rotation roster
 *
 * IMPORTANT: Day columns (Sun…Sat) are the source of truth for work / RDO / times.
 * Do NOT invent sex, quals, or times from shiftId when a day cell exists.
 * RDO / OFF / empty day cells must not become working rows.
 */
(function () {
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function posOf(line) {
    if (!line) return "";
    if (line.position === "STSO" || line.position === "LTSO" || line.position === "TSO") {
      return line.position;
    }
    if (window.Scheduler && Scheduler.linePosition) {
      var p = Scheduler.linePosition(line);
      if (p) return p;
    }
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    var code = String(line.lineCode || line.n || "").toUpperCase();
    if (/^STSO\b/.test(code)) return "STSO";
    if (/^LTSO\b/.test(code)) return "LTSO";
    if (line.empClass === "FT" || line.empClass === "PT" || line.empClass === "TSO") return "TSO";
    return line.position || line.empClass || "";
  }

  function sexOf(line) {
    if (!line) return "";
    var x = line.sex != null ? line.sex : line.Sex;
    if (x == null || x === "") return "";
    x = String(x).trim().toUpperCase();
    if (x === "F" || x === "FEMALE") return "F";
    if (x === "M" || x === "MALE") return "M";
    return x;
  }

  function bladeLine(id) {
    var lines = window.Scheduler && Scheduler.state && Scheduler.state.lines || [];
    var raw = String(id == null ? "" : id).replace(/^L(?:INE-)?/i, "");
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].id) === raw || String(lines[i].id) === String(id)) return lines[i];
      if (lines[i].lineCode && String(lines[i].lineCode) === String(id)) return lines[i];
    }
    return null;
  }

  function isDemoRoster(rows) {
    if (!rows || !rows.length) return false;
    var n = String(rows[0].n || "");
    return /Okafor|Rivera, Ana|Chen, Wei/.test(n) || rows[0].k === "10001";
  }

  function locForLineDay(Sch, line, di) {
    var gen2 = Sch.state && Sch.state.operationalLines;
    if (gen2 && gen2.length) {
      for (var i = 0; i < gen2.length; i++) {
        var g = gen2[i];
        if (String(g.id) === String(line.id) && g.day === di && g.placed && g.locKey) return g;
      }
    }
    var teamId = line.teamId;
    if (!teamId && Sch.teams && Sch.teams.teams) {
      Sch.teams.teams.forEach(function (t) {
        if ((t.members || []).some(function (m) { return String(m) === String(line.id); })) teamId = t.id;
      });
    }
    if (teamId && Sch.placementForTeamDay) return Sch.placementForTeamDay(teamId, di % 7);
    return null;
  }

  function timesForLineDay(Sch, line, di) {
    var ad = window.BladeLinesAdapter;
    if (ad) {
      var raw = ad.dayValueOf(line, di);
      if (raw != null && String(raw).trim() !== "") {
        if (ad.OFF_RE && ad.OFF_RE.test(String(raw).trim())) return null;
        var parsed = ad.parseTime(raw);
        if (parsed) {
          return {
            startMin: parsed.startMin,
            endMin: parsed.endMin,
            shiftName: parsed.shift,
            raw: parsed.raw,
            fromDayCell: true
          };
        }
        return null;
      }
    }

    var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
    if (sched[di] !== "WORK") return null;

    var start = 240;
    var end = start + Math.round((line.paid || 8) * 60);
    if (Sch.getEffectiveShiftTimes && line.shiftId) {
      var eff = Sch.getEffectiveShiftTimes(line.shiftId, di);
      if (eff && Sch.timeToMin) {
        start = Sch.timeToMin(eff.start);
        end = Sch.timeToMin(eff.end);
      }
    } else if (Sch.getShift && line.shiftId) {
      var sh = Sch.getShift(line.shiftId);
      if (sh && Sch.timeToMin) {
        start = Sch.timeToMin(sh.start);
        end = Sch.timeToMin(sh.end);
      }
    }
    if (end <= start) end += 1440;
    return {
      startMin: start,
      endMin: end,
      shiftName: start < 12 * 60 ? "AM" : "PM",
      fromDayCell: false
    };
  }

  function rewriteRoster() {
    var Sch = window.Scheduler;
    var RS = window.S;
    if (!Sch || !Sch.state || !Sch.state.lines || !Sch.state.lines.length || !RS) return;
    if (Sch.normalizeAllLineRoles) Sch.normalizeAllLineRoles();

    var rows = [];
    var locCounts = {};
    var unplaced = 0;
    var skipped = 0;
    var ad = window.BladeLinesAdapter;

    Sch.state.lines.forEach(function (line, index) {
      var pos = posOf(line);
      var sex = sexOf(line);
      var key = ad && ad.lineKey
        ? ad.lineKey(line, index)
        : ("LINE-" + String(line.id != null ? line.id : index + 1).padStart(3, "0"));
      var name = line.lineCode || ("Line " + String(line.id != null ? line.id : index + 1).padStart(3, "0"));

      for (var di = 0; di < 7; di++) {
        var times = timesForLineDay(Sch, line, di);
        if (!times) {
          skipped++;
          continue;
        }

        var duty = Sch.getRotationDuty
          ? (Sch.getRotationDuty(line.id, di) || "")
          : ((Sch.state.functionRotation || {})[String(line.id)] || [])[di] || line.function || "";
        if (duty === "PAX") duty = "";

        var title = pos || "";
        if (duty === "DFO" && pos) title = pos + "/DFO";
        if (duty === "BAG" && pos) title = pos + "/BAG";

        var home = locForLineDay(Sch, line, di);
        var loc = "";
        if (duty === "BAG") loc = "BAG";
        else if (duty === "DFO") loc = "DFO";
        else if (home) loc = home.locKey || home.zone || home.checkpoint || "";
        if (!loc) unplaced++;
        if (loc) locCounts[loc] = (locCounts[loc] || 0) + 1;

        var notes = [];
        if (duty) notes.push(duty);
        notes.push(DOW[di]);
        if (home && home.modset) notes.push(home.modset);

        rows.push({
          k: key,
          n: name,
          ti: title,
          po: duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : (pos || "TDC"),
          lo: loc,
          d: "",
          dow: di,
          sh: times.shiftName,
          s: times.startMin,
          e: times.endMin,
          x: sex,
          q: "",
          ab: [],
          tr: [],
          nt: notes,
          generation: 2,
          position: pos,
          duty: duty || undefined,
          needsPlacement: !loc,
          sourceDayValue: times.raw || undefined
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
            t: id[0],
            open: "03:30",
            close: "23:00",
            mods: [[{ n: 1, ct: 0 }, { n: 2, ct: 0 }]],
            kcm: null,
            exit: { am: 0, pm: 0 }
          };
        }
      });
    }

    RS.roster = rows;
    RS.meta = {
      file: "(BLADE lines)",
      rows: rows.length,
      when: "line-map",
      dates: [],
      unknown: {},
      locs: locCounts,
      unplaced: unplaced,
      skipped: skipped
    };
    if (typeof DB !== "undefined" && DB.set) {
      DB.set("roster", rows);
      DB.set("rosterMeta", RS.meta);
    }
    var info = document.getElementById("rosterInfo");
    if (info) {
      var extra = unplaced ? (" · " + unplaced + " unplaced") : "";
      info.innerHTML = "<b>" + rows.length + "</b> BLADE line-days · day cells authoritative" + extra;
    }
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
      if (pos) p.ti = duty ? pos + "/" + duty : pos;
      var sx = sexOf(line);
      if (sx) p.sex = sx;
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
    setTimeout(function () {
      if (window.Scheduler && Scheduler.state && Scheduler.state.lines && Scheduler.state.lines.length) {
        rewriteRoster();
      }
    }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 200); });
  else setTimeout(boot, 200);
})();

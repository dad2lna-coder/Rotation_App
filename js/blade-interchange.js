/**
 * Debug / Interchange workbook.
 * Classifies each Sun–Sat cell in place. Time range = WORKING. RDO/OFF only = OFF.
 * Blank is UNKNOWN, never OFF.
 */
(function (global) {
  "use strict";

  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_COLS = [
    "Line Key", "Line", "Position", "Sex", "Day", "Raw", "Status",
    "Start", "End", "Team", "Location", "Modset", "Function",
    "Rotation Position", "Validation"
  ];

  var overlay = {};

  function Sch() { return global.Scheduler; }
  function RS() { return global.S; }
  function Ad() { return global.BladeLinesAdapter; }

  function overlayKey(lineKey, di) { return String(lineKey) + "|" + String(di); }
  function overlayFor(lineKey, di) { return overlay[overlayKey(lineKey, di)] || null; }
  function setOverlay(lineKey, di, patch) {
    var k = overlayKey(lineKey, di);
    overlay[k] = Object.assign({}, overlay[k] || {}, patch || {});
  }

  function parseClock(s) {
    if (s == null || String(s).trim() === "") return null;
    var m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var d = String(s).replace(/\D/g, "");
    if (d.length === 3 || d.length === 4) {
      var hh = d.length === 3 ? parseInt(d.slice(0, 1), 10) : parseInt(d.slice(0, 2), 10);
      var mm = d.length === 3 ? parseInt(d.slice(1), 10) : parseInt(d.slice(2), 10);
      if (mm < 60) return hh * 60 + mm;
    }
    return null;
  }

  function compact(start, end) {
    function hhmm(t) {
      if (t == null) return "";
      var s = String(t).trim();
      var m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m) return (m[1].length < 2 ? "0" + m[1] : m[1]) + m[2];
      var d = s.replace(/\D/g, "");
      return d.length === 3 ? "0" + d : d;
    }
    var a = hhmm(start), b = hhmm(end);
    return a && b ? a + "-" + b : "";
  }

  function schedVal(S, line, di) {
    if (!S || !S.state || !S.state.schedule || !line) return "";
    var row = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
    return row[di] == null ? "" : String(row[di]);
  }

  function namedDay(ad, line, di) {
    if (ad && ad.dayValueOf) {
      var v = ad.dayValueOf(line, di);
      if (v != null && String(v).trim() !== "") return String(v);
    }
    var keys = [DOW[di], DOW_SHORT[di], DOW[di].toLowerCase(), DOW_SHORT[di].toLowerCase()];
    for (var i = 0; i < keys.length; i++) {
      if (line[keys[i]] != null && String(line[keys[i]]).trim() !== "") return String(line[keys[i]]);
    }
    return "";
  }

  function shiftRange(S, line, di) {
    if (!S || !line) return "";
    if (S.getEffectiveShiftTimes && line.shiftId) {
      var eff = S.getEffectiveShiftTimes(line.shiftId, di);
      if (eff && eff.start && eff.end) return compact(eff.start, eff.end);
    }
    if (S.getShift && line.shiftId) {
      var sh = S.getShift(line.shiftId);
      if (sh && sh.start && sh.end) return compact(sh.start, sh.end);
    }
    if (line.shiftLabel) return String(line.shiftLabel);
    return "";
  }

  function classifyCell(S, ad, line, di) {
    var named = namedDay(ad, line, di);
    var sched = schedVal(S, line, di);
    var raw = named || sched || "";
    var parsed = ad && ad.parseTime ? ad.parseTime(raw) : null;
    if (!parsed && named) parsed = ad && ad.parseTime ? ad.parseTime(named) : null;
    if (!parsed && sched) parsed = ad && ad.parseTime ? ad.parseTime(sched) : null;

    var rec = { raw: raw || named || sched || "", status: "UNKNOWN", start: "", end: "", startMin: null, endMin: null };

    if (parsed) {
      rec.status = "WORKING";
      rec.start = parsed.start;
      rec.end = parsed.end;
      rec.startMin = parsed.startMin;
      rec.endMin = parsed.endMin;
      rec.raw = parsed.raw || raw;
      return rec;
    }

    if (/^(RDO|OFF|DAY\s*OFF)$/i.test(String(raw).trim()) || /^(RDO|OFF)$/i.test(String(sched).trim())) {
      rec.status = "OFF";
      rec.raw = raw || sched || "RDO";
      return rec;
    }

    if (/^(WORK|WORKING)$/i.test(String(raw).trim()) || /^(WORK|WORKING)$/i.test(String(sched).trim())) {
      var range = shiftRange(S, line, di);
      var p2 = range && ad && ad.parseTime ? ad.parseTime(range) : null;
      rec.status = "WORKING";
      rec.raw = range || raw || "WORK";
      if (p2) {
        rec.start = p2.start; rec.end = p2.end;
        rec.startMin = p2.startMin; rec.endMin = p2.endMin;
      }
      return rec;
    }

    rec.status = "UNKNOWN";
    rec.raw = raw;
    return rec;
  }

  function teamOfLine(S, line) {
    if (line.teamId && S.getTeamById) return S.getTeamById(line.teamId);
    var teams = (S.teams && S.teams.teams) || [];
    for (var i = 0; i < teams.length; i++) {
      var mem = teams[i].members || [];
      for (var j = 0; j < mem.length; j++) {
        if (String(mem[j]) === String(line.id)) return teams[i];
      }
    }
    return null;
  }

  function locHome(S, line, di) {
    var gen2 = S.state && S.state.operationalLines;
    if (gen2) {
      for (var i = 0; i < gen2.length; i++) {
        var g = gen2[i];
        if (String(g.id) === String(line.id) && g.day === di && g.placed) return g;
      }
    }
    var team = teamOfLine(S, line);
    if (team && S.placementForTeamDay) return S.placementForTeamDay(team.id, di);
    return null;
  }

  function dutyOf(S, line, di) {
    if (S.getRotationDuty) {
      var d = S.getRotationDuty(line.id, di) || "";
      return d === "PAX" ? "" : d;
    }
    var row = (S.state.functionRotation || {})[String(line.id)] || [];
    var v = row[di] || line.function || "";
    return v === "PAX" ? "" : v;
  }

  function positionOf(line) {
    if (Ad() && Ad().positionOf) return Ad().positionOf(line);
    return line.position || line.empClass || line.jobTitle || "";
  }

  function buildModel() {
    var S = Sch();
    var ad = Ad();
    var days = [[], [], [], [], [], [], []];
    var raw = [];
    var debug = [];
    var placement = [];
    var functions = [];
    var validation = [];
    var lines = (S && S.state && S.state.lines) || [];

    var matrix = S && S.state && S.state.placementMatrix;
    if (matrix && matrix.rows) {
      matrix.rows.forEach(function (p) {
        placement.push({
          Team: p.teamName || p.teamId || "", Day: p.dow || DOW_SHORT[p.day] || "",
          Location: p.locKey || "", Modset: p.modset || "", Program: p.program || ""
        });
      });
    }

    var work = 0, offN = 0, unk = 0;
    lines.forEach(function (line, index) {
      var key = ad && ad.lineKey ? ad.lineKey(line, index) : ("LINE-" + String(line.id != null ? line.id : index + 1).padStart(3, "0"));
      var name = ad && ad.lineDisplayName ? ad.lineDisplayName(line, index) : (line.lineCode || key);
      var pos = positionOf(line);
      var sex = line.sex != null && line.sex !== "" ? String(line.sex).trim().toUpperCase() : "";
      var team = teamOfLine(S, line);
      var rawRow = { "Line Key": key, Line: name, Position: pos, Sex: sex, Team: team ? (team.name || team.id) : "" };
      for (var di = 0; di < 7; di++) {
        var cls = classifyCell(S, ad, line, di);
        rawRow[DOW[di]] = cls.raw;
        if (cls.status === "WORKING") work++;
        else if (cls.status === "OFF") offN++;
        else unk++;

        var home = locHome(S, line, di);
        var duty = dutyOf(S, line, di);
        var loc = home ? (home.locKey || "") : "";
        var errs = [];
        if (!pos) errs.push("missing Position");
        if (cls.status === "WORKING" && (!cls.start || !cls.end)) errs.push("working missing time");
        if (cls.status === "WORKING" && !loc) errs.push("missing Location");

        var rec = {
          lineKey: key, line: name, position: pos || "", sex: sex,
          day: DOW[di], raw: cls.raw, status: cls.status,
          start: cls.start, end: cls.end,
          team: team ? (team.name || team.id) : "",
          location: loc, modset: home ? (home.modset || "") : "",
          functionName: duty || "", rotationPosition: "",
          validation: errs.join("; ")
        };
        days[di].push(rec);
        debug.push({
          Line: name, Day: DOW_SHORT[di],
          rawDayValue: cls.raw, dayStatus: cls.status,
          start: cls.start, end: cls.end
        });
        if (errs.length) validation.push({ Line: name, Day: DOW[di], Status: cls.status, Issues: rec.validation, Raw: cls.raw });
        if (duty) functions.push({ Line: name, Day: DOW[di], Position: pos, Function: duty });
      }
      raw.push(rawRow);
    });

    var summary = [
      { Field: "schema", Value: "blade.interchange.v1" },
      { Field: "lines", Value: lines.length },
      { Field: "working line-days", Value: work },
      { Field: "off/rdo line-days", Value: offN },
      { Field: "unknown line-days", Value: unk },
      { Field: "debug", Value: "See Debug tab: rawDayValue → dayStatus → start → end" }
    ];
    return { days: days, raw: raw, debug: debug, placement: placement, functions: functions, validation: validation, summary: summary };
  }

  function dayAoa(list) {
    var aoa = [DAY_COLS];
    list.forEach(function (r) {
      aoa.push([r.lineKey, r.line, r.position, r.sex, r.day, r.raw, r.status, r.start, r.end, r.team, r.location, r.modset, r.functionName, r.rotationPosition, r.validation]);
    });
    return aoa;
  }

  function downloadWb(wb, name) {
    var XLSX = global.XLSX;
    var out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    var blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function exportWorkbook() {
    var XLSX = global.XLSX;
    if (!XLSX) { alert("XLSX library is not loaded."); return; }
    var model = buildModel();
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.debug.length ? model.debug : [{ rawDayValue: "", dayStatus: "", start: "", end: "" }]), "Debug");
    DOW.forEach(function (name, i) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayAoa(model.days[i])), name);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.placement.length ? model.placement : [{ Team: "" }]), "Placement");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.functions.length ? model.functions : [{ Function: "" }]), "Function");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.validation.length ? model.validation : [{ Issues: "none" }]), "Validation");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.raw.length ? model.raw : [{ "Line Key": "" }]), "Raw_BLADE");
    downloadWb(wb, "blade-interchange-" + new Date().toISOString().slice(0, 10) + ".xlsx");
    var S = Sch();
    if (S && S.updateStatus) {
      var w = model.summary[2] && model.summary[2].Value;
      var o = model.summary[3] && model.summary[3].Value;
      S.updateStatus("Interchange exported · WORKING " + w + " · OFF " + o + " · see Debug tab");
    }
  }

  function headerMap(row) {
    var m = {};
    Object.keys(row || {}).forEach(function (k) { m[String(k).trim().toLowerCase()] = k; });
    return function (name) { var hit = m[name.toLowerCase()]; return hit ? row[hit] : ""; };
  }

  function applyImportedRows(imported) {
    var S = Sch();
    var R = RS();
    if (!S || !S.state) return { rows: 0 };
    if (!S.state.functionRotation) S.state.functionRotation = {};
    var roster = [];
    imported.forEach(function (r) {
      setOverlay(r.lineKey, r.dayIndex, {
        Position: r.position, Location: r.location, Modset: r.modset, Team: r.team,
        Function: r.functionName, Start: r.start, End: r.end
      });
      if (/^OFF$/i.test(r.status)) return;
      var startMin = parseClock(r.start);
      var endMin = parseClock(r.end);
      if (startMin == null || endMin == null) return;
      if (endMin <= startMin) endMin += 1440;
      roster.push({
        k: r.lineKey, n: r.line, ti: r.position || "", po: r.position || "", lo: r.location || "",
        d: "", dow: r.dayIndex, sh: startMin < 720 ? "AM" : "PM", s: startMin, e: endMin,
        x: r.sex || "", q: "", ab: [], tr: [], nt: [DOW_SHORT[r.dayIndex]],
        generation: 2, position: r.position || "", fromInterchange: true
      });
    });
    if (R) {
      R.roster = roster;
      R.meta = { file: "(interchange workbook)", rows: roster.length, when: "xlsx-import" };
      if (typeof DB !== "undefined" && DB.set) { DB.set("roster", R.roster); DB.set("rosterMeta", R.meta); }
    }
    return { rows: roster.length };
  }

  function importWorkbook(file) {
    var XLSX = global.XLSX;
    if (!XLSX) { alert("XLSX library is not loaded."); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array" });
        var imported = [];
        DOW.forEach(function (name, di) {
          var sheet = wb.Sheets[name];
          if (!sheet) return;
          XLSX.utils.sheet_to_json(sheet, { defval: "" }).forEach(function (row) {
            var g = headerMap(row);
            imported.push({
              lineKey: String(g("Line Key") || "").trim(),
              line: String(g("Line") || "").trim(),
              position: String(g("Position") || "").trim(),
              sex: String(g("Sex") || "").trim().toUpperCase(),
              day: name, dayIndex: di,
              start: String(g("Start") || "").trim(),
              end: String(g("End") || "").trim(),
              team: String(g("Team") || "").trim(),
              location: String(g("Location") || "").trim(),
              modset: String(g("Modset") || "").trim(),
              functionName: String(g("Function") || "").trim(),
              status: String(g("Status") || "").trim() || "WORKING"
            });
          });
        });
        var result = applyImportedRows(imported);
        if (Sch() && Sch().updateStatus) Sch().updateStatus("Imported " + result.rows + " interchange rows.");
      } catch (err) {
        alert("Could not import workbook: " + (err && err.message ? err.message : err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function hookUi() {
    var btnExp = document.getElementById("btn-export-interchange");
    var btnImp = document.getElementById("btn-import-interchange");
    var file = document.getElementById("fInterchange");
    if (btnExp && !btnExp._hooked) {
      btnExp._hooked = true;
      btnExp.addEventListener("click", exportWorkbook);
    }
    if (btnImp && file && !btnImp._hooked) {
      btnImp._hooked = true;
      btnImp.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        if (file.files && file.files[0]) importWorkbook(file.files[0]);
        file.value = "";
      });
    }
  }

  global.BladeInterchange = {
    exportWorkbook: exportWorkbook,
    importWorkbook: importWorkbook,
    overlayFor: overlayFor,
    setOverlay: setOverlay,
    buildModel: buildModel,
    classifyCell: classifyCell,
    hookUi: hookUi
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookUi);
  else hookUi();
})(typeof window !== "undefined" ? window : this);

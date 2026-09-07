/**
 * Debug / Interchange workbook
 * BLADE → Adapter → F7 → XLSX → edit → import → validation → Rotation
 *
 * Does not invent TDC/BAG/DFO. Missing fields stay empty and land on Validation.
 */
(function (global) {
  "use strict";

  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_COLS = [
    "Line Key", "Line", "Position", "Sex", "Day", "Start", "End",
    "Team", "Location", "Modset", "Function", "Rotation Position",
    "Status", "Validation"
  ];

  var overlay = {};

  function Sch() { return global.Scheduler; }
  function RS() { return global.S; }
  function Ad() { return global.BladeLinesAdapter; }

  function overlayKey(lineKey, di) { return String(lineKey) + "|" + String(di); }

  function overlayFor(lineKey, di) {
    return overlay[overlayKey(lineKey, di)] || null;
  }

  function setOverlay(lineKey, di, patch) {
    var k = overlayKey(lineKey, di);
    overlay[k] = Object.assign({}, overlay[k] || {}, patch || {});
  }

  function clearOverlay() { overlay = {}; }

  function parseClock(s) {
    if (s == null || String(s).trim() === "") return null;
    var m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var d = String(s).replace(/\D/g, "");
    if (d.length === 3 || d.length === 4) {
      var hh = d.length === 3 ? parseInt(d.slice(0,1),10) : parseInt(d.slice(0,2),10);
      var mm = d.length === 3 ? parseInt(d.slice(1),10) : parseInt(d.slice(2),10);
      if (mm < 60) return hh * 60 + mm;
    }
    return null;
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

  function validateRow(r, seen) {
    var errs = [];
    if (!r.position) errs.push("missing Position");
    if (r.status === "WORK") {
      if (!r.start || !r.end) errs.push("missing time");
      if (!r.team) errs.push("missing Team");
      if (!r.location) errs.push("missing Location");
      if (!r.modset) errs.push("missing Modset");
    }
    if (r.status === "INVALID_TIME") errs.push("invalid time");
    var dk = r.lineKey + "|" + r.dayIndex;
    if (r.status === "WORK") {
      if (seen[dk]) errs.push("duplicate line-day");
      seen[dk] = true;
    }
    return errs;
  }

  function buildModel() {
    var S = Sch();
    var ad = Ad();
    var days = [[], [], [], [], [], [], []];
    var raw = [];
    var placement = [];
    var functions = [];
    var validation = [];
    var seen = {};
    var lines = (S && S.state && S.state.lines) || [];

    var matrix = S && S.state && S.state.placementMatrix;
    if (matrix && matrix.rows) {
      matrix.rows.forEach(function (p) {
        placement.push({
          Team: p.teamName || p.teamId || "",
          Day: p.dow || DOW_SHORT[p.day] || "",
          Location: p.locKey || "",
          Zone: p.zone || p.checkpoint || "",
          Modset: p.modset || "",
          Program: p.program || "",
          Score: p.score != null ? p.score : "",
          Reason: p.reason || "",
          Work: p.work != null ? p.work : ""
        });
      });
    }

    lines.forEach(function (line, index) {
      var key = ad && ad.lineKey ? ad.lineKey(line, index) : ("LINE-" + String(line.id != null ? line.id : index + 1).padStart(3, "0"));
      var name = ad && ad.lineDisplayName ? ad.lineDisplayName(line, index) : (line.lineCode || key);
      var pos = positionOf(line);
      var sex = line.sex != null && line.sex !== "" ? String(line.sex).trim().toUpperCase() : "";
      var team = teamOfLine(S, line);
      var rawRow = {
        "Line Key": key, Line: name, Position: pos, Sex: sex,
        Team: team ? (team.name || team.id) : "",
        Sunday: "", Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: ""
      };
      for (var di = 0; di < 7; di++) {
        var rawV = ad ? ad.dayValueOf(line, di) : "";
        rawRow[DOW[di]] = rawV == null ? "" : String(rawV);
        var parsed = ad && ad.parseTime ? ad.parseTime(rawV) : null;
        var off = !String(rawV || "").trim() || (ad && ad.OFF_RE && ad.OFF_RE.test(String(rawV).trim()));
        var home = locHome(S, line, di);
        var duty = dutyOf(S, line, di);
        var ov = overlayFor(key, di);
        var rec = {
          lineKey: key, line: name, position: pos, sex: sex,
          day: DOW[di], dayIndex: di,
          start: parsed ? parsed.start : "", end: parsed ? parsed.end : "",
          team: team ? (team.name || team.id) : "", teamId: team ? team.id : "",
          location: home ? (home.locKey || "") : "",
          modset: home ? (home.modset || "") : "",
          functionName: duty || "", rotationPosition: "",
          status: parsed ? "WORK" : (off ? "OFF" : "INVALID_TIME"),
          source: String(rawV || "")
        };
        if (ov) {
          if (ov.Position) rec.position = ov.Position;
          if (ov.Location) rec.location = ov.Location;
          if (ov.Modset) rec.modset = ov.Modset;
          if (ov.Team) rec.team = ov.Team;
          if (ov.Function != null) rec.functionName = ov.Function;
          if (ov["Rotation Position"] != null) rec.rotationPosition = ov["Rotation Position"];
          if (ov.Start) rec.start = ov.Start;
          if (ov.End) rec.end = ov.End;
        }
        var errs = validateRow(rec, seen);
        rec.validation = errs.join("; ");
        days[di].push(rec);
        if (errs.length) validation.push({ "Line Key": key, Line: name, Day: DOW[di], Status: rec.status, Issues: rec.validation, Source: rec.source });
        if (rec.functionName) functions.push({ "Line Key": key, Line: name, Day: DOW[di], Position: rec.position, Function: rec.functionName, Location: rec.location, Source: "functionRotation or overlay" });
      }
      raw.push(rawRow);
    });

    var work = 0, offN = 0, bad = 0, unplaced = 0;
    days.forEach(function (list) {
      list.forEach(function (r) {
        if (r.status === "WORK") { work++; if (!r.location) unplaced++; }
        else if (r.status === "OFF") offN++;
        else bad++;
      });
    });
    var summary = [
      { Field: "schema", Value: "blade.interchange.v1" },
      { Field: "lines", Value: lines.length },
      { Field: "working line-days", Value: work },
      { Field: "off/rdo line-days", Value: offN },
      { Field: "invalid time", Value: bad },
      { Field: "missing location", Value: unplaced },
      { Field: "validation issues", Value: validation.length },
      { Field: "overlay cells", Value: Object.keys(overlay).length },
      { Field: "note", Value: "Position is BLADE source. Function is a separate explicit stage. TDC is never auto-assigned." }
    ];
    return { days: days, raw: raw, placement: placement, functions: functions, validation: validation, summary: summary };
  }

  function dayAoa(list) {
    var aoa = [DAY_COLS];
    list.forEach(function (r) {
      aoa.push([r.lineKey, r.line, r.position, r.sex, r.day, r.start, r.end, r.team, r.location, r.modset, r.functionName, r.rotationPosition, r.status, r.validation]);
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
    DOW.forEach(function (name, i) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayAoa(model.days[i])), name);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.placement.length ? model.placement : [{ Team: "", Day: "", Location: "", Modset: "" }]), "Placement");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.functions.length ? model.functions : [{ "Line Key": "", Day: "", Function: "" }]), "Function");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.validation.length ? model.validation : [{ "Line Key": "", Issues: "none" }]), "Validation");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.raw.length ? model.raw : [{ "Line Key": "" }]), "Raw_BLADE");
    downloadWb(wb, "blade-interchange-" + new Date().toISOString().slice(0, 10) + ".xlsx");
    if (Sch() && Sch().updateStatus) Sch().updateStatus("Exported debug / interchange workbook.");
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
    var locCounts = {};
    var unplaced = 0;
    imported.forEach(function (r) {
      setOverlay(r.lineKey, r.dayIndex, {
        Position: r.position, Location: r.location, Modset: r.modset, Team: r.team,
        Function: r.functionName, "Rotation Position": r.rotationPosition, Start: r.start, End: r.end
      });
      if (r.status === "OFF") return;
      if (r.status !== "WORK" && !(r.start && r.end)) return;
      var startMin = parseClock(r.start);
      var endMin = parseClock(r.end);
      if (startMin == null || endMin == null) return;
      if (endMin <= startMin) endMin += 1440;
      var lineId = String(r.lineKey).replace(/^LINE-/i, "");
      if (!S.state.functionRotation[lineId]) S.state.functionRotation[lineId] = [];
      S.state.functionRotation[lineId][r.dayIndex] = r.functionName || null;
      if (r.location) locCounts[r.location] = (locCounts[r.location] || 0) + 1;
      else unplaced++;
      var title = r.position || "";
      if (r.functionName === "DFO" && title) title = title + "/DFO";
      if (r.functionName === "BAG" && title) title = title + "/BAG";
      roster.push({
        k: r.lineKey, n: r.line, ti: title, po: r.position || "", lo: r.location || "",
        d: "", dow: r.dayIndex, sh: startMin < 720 ? "AM" : "PM", s: startMin, e: endMin,
        x: r.sex || "", q: "", ab: [], tr: [],
        nt: [r.functionName || DOW_SHORT[r.dayIndex], r.modset].filter(Boolean),
        teamId: r.team || "", generation: 2, position: r.position || "",
        duty: r.functionName || "", functionName: r.functionName || "",
        rotationPosition: r.rotationPosition || "", needsPlacement: !r.location, fromInterchange: true
      });
    });
    if (R) {
      R.roster = roster;
      R.meta = { file: "(interchange workbook)", rows: roster.length, when: "xlsx-import", dates: [], unknown: {}, locs: locCounts, unplaced: unplaced };
      if (typeof DB !== "undefined" && DB.set) { DB.set("roster", R.roster); DB.set("rosterMeta", R.meta); }
    }
    S.state.interchangeImported = true;
    return { rows: roster.length, unplaced: unplaced };
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
              rotationPosition: String(g("Rotation Position") || "").trim(),
              status: String(g("Status") || "").trim() || "WORK"
            });
          });
        });
        var result = applyImportedRows(imported);
        var info = document.getElementById("rosterInfo");
        if (info) info.innerHTML = "<b>" + result.rows + "</b> imported interchange line-days (edits preserved)";
        if (Sch() && Sch().updateStatus) Sch().updateStatus("Imported interchange workbook · " + result.rows + " working rows. Edited Location/Modset/Function kept.");
      } catch (err) {
        console.warn(err);
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
      btnExp.addEventListener("click", function () { exportWorkbook(); });
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
    clearOverlay: clearOverlay,
    buildModel: buildModel,
    hookUi: hookUi
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookUi);
  else hookUi();
})(typeof window !== "undefined" ? window : this);

/** Import / export — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function normalizeLine(raw) {
    if (!raw || typeof raw !== "object" || raw.id == null) return null;
    return {
      id: raw.id,
      lineCode: raw.lineCode || ("Line " + String(raw.id).padStart(3, "0")),
      shiftId: raw.shiftId || "",
      shiftName: raw.shiftName || "",
      shiftLabel: raw.shiftLabel || "",
      empClass: raw.empClass || "",
      position: raw.position || raw.empClass || "",
      isLtso: Boolean(raw.isLtso),
      isStso: Boolean(raw.isStso),
      sex: raw.sex === "F" ? "F" : "M",
      function: raw.function === "DFO" || raw.function === "PAX" || raw.function === "BAG" ? raw.function : "",
      rdoDays: Array.isArray(raw.rdoDays) ? raw.rdoDays.map(Number).filter(function (x) { return Number.isInteger(x) && x >= 0 && x <= 6; }) : [],
      rdoHard: Boolean(raw.rdoHard),
      paid: S.safeNumber(raw.paid, 8, 1, 24)
    };
  }

  function normalizeSchedule(rawSchedule, validLineIds) {
    var out = {};
    if (!rawSchedule || typeof rawSchedule !== "object") return out;
    var valid = new Set(validLineIds.map(String));
    Object.keys(rawSchedule).forEach(function (key) {
      if (!valid.has(String(key))) return;
      var arr = Array.isArray(rawSchedule[key]) ? rawSchedule[key] : [];
      out[key] = arr.map(function (v) { return v === "WORK" ? "WORK" : "RDO"; });
    });
    return out;
  }

  S.exportJson = function () {
    S.readShiftsFromDom();
    S.state.open = (S.$("cfg-open") && S.$("cfg-open").value) || S.state.open;
    S.state.close = (S.$("cfg-close") && S.$("cfg-close").value) || S.state.close;
    S.state.weekCount = Math.max(1, Math.min(8, +(S.$("cfg-weeks") && S.$("cfg-weeks").value) || S.state.weekCount));
    S.state.ftM = Math.max(0, +(S.$("cfg-ft-m") && S.$("cfg-ft-m").value) || 0);
    S.state.ftF = Math.max(0, +(S.$("cfg-ft-f") && S.$("cfg-ft-f").value) || 0);
    S.state.ptM = Math.max(0, +(S.$("cfg-pt-m") && S.$("cfg-pt-m").value) || 0);
    S.state.ptF = Math.max(0, +(S.$("cfg-pt-f") && S.$("cfg-pt-f").value) || 0);
    S.state.ltsoM = Math.max(0, +(S.$("cfg-ltso-m") && S.$("cfg-ltso-m").value) || 0);
    S.state.ltsoF = Math.max(0, +(S.$("cfg-ltso-f") && S.$("cfg-ltso-f").value) || 0);
    S.state.stsoM = Math.max(0, +(S.$("cfg-stso-m") && S.$("cfg-stso-m").value) || 0);
    S.state.stsoF = Math.max(0, +(S.$("cfg-stso-f") && S.$("cfg-stso-f").value) || 0);
    var startDateValue = (S.$("cfg-start") && S.$("cfg-start").value) || null;
    var payload = {
      app: "scheduler-pre-v2", version: 4, exportedAt: S.dj().toISOString(),
      config: {
        open: S.state.open, close: S.state.close, startDate: startDateValue, weekCount: S.state.weekCount,
        useDynamicHours: !!S.state.useDynamicHours, dayHours: S.state.dayHours || null,
        ftM: S.state.ftM, ftF: S.state.ftF, ptM: S.state.ptM, ptF: S.state.ptF,
        ltsoM: S.state.ltsoM, ltsoF: S.state.ltsoF, stsoM: S.state.stsoM, stsoF: S.state.stsoF, shifts: S.state.shifts
      },
      results: { lines: S.state.lines, schedule: S.state.schedule, mode: S.state.mode, issues: S.state.issues, functionRotation: S.state.functionRotation || {} }
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); var url = URL.createObjectURL(blob);
    a.href = url; a.download = "scheduler-pre-v4-export-" + S.dj().format("YYYY-MM-DD") + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    S.updateStatus("Exported config and results JSON.");
  };

  S.applyPayload = function (payload) {
    if (!payload || typeof payload !== "object") throw new Error("Invalid JSON payload.");
    var cfg = payload.config || payload.legacy || payload;
    var results = payload.results || payload.legacy || payload;
    S.state.open = S.isValidTimeText(cfg.open) ? cfg.open : "03:30";
    S.state.close = S.isValidTimeText(cfg.close) ? cfg.close : "23:00";
    S.state.useDynamicHours = !!cfg.useDynamicHours;
    if (Array.isArray(cfg.dayHours) && cfg.dayHours.length === 7) {
      S.state.dayHours = cfg.dayHours.map(function (dh) {
        return { open: S.isValidTimeText(dh && dh.open) ? dh.open : S.state.open, close: S.isValidTimeText(dh && dh.close) ? dh.close : S.state.close };
      });
    } else if (S.defaultDayHours) S.state.dayHours = S.defaultDayHours();
    S.state.weekCount = Math.floor(S.safeNumber(cfg.weekCount, 1, 1, 8));
    S.state.ftM = Math.floor(S.safeNumber(cfg.ftM, 0, 0, null));
    S.state.ftF = Math.floor(S.safeNumber(cfg.ftF, 0, 0, null));
    S.state.ptM = Math.floor(S.safeNumber(cfg.ptM, 0, 0, null));
    S.state.ptF = Math.floor(S.safeNumber(cfg.ptF, 0, 0, null));
    S.state.ltsoM = Math.floor(S.safeNumber(cfg.ltsoM, 0, 0, null));
    S.state.ltsoF = Math.floor(S.safeNumber(cfg.ltsoF, 0, 0, null));
    S.state.stsoM = Math.floor(S.safeNumber(cfg.stsoM, 0, 0, null));
    S.state.stsoF = Math.floor(S.safeNumber(cfg.stsoF, 0, 0, null));
    S.state.startDate = S.parseStartDate(cfg.startDate || payload.startDate || null);
    S.state.shifts = Array.isArray(cfg.shifts) && cfg.shifts.length > 0 ? cfg.shifts.map(S.normalizeShift) : S.defaultShifts();
    S.state.lines = Array.isArray(results.lines) ? results.lines.map(normalizeLine).filter(Boolean) : [];
    S.state.schedule = normalizeSchedule(results.schedule, S.state.lines.map(function (l) { return l.id; }));
    S.state.functionRotation = results.functionRotation && typeof results.functionRotation === "object" ? results.functionRotation : {};
    S.state.mode = typeof results.mode === "string" ? results.mode : "imported";
    S.state.issues = Array.isArray(results.issues) ? results.issues.map(String) : [];
    S.setInputValue("cfg-open", S.state.open); S.setInputValue("cfg-close", S.state.close);
    S.setInputValue("cfg-weeks", S.state.weekCount); S.setInputValue("cfg-ft-m", S.state.ftM); S.setInputValue("cfg-ft-f", S.state.ftF);
    S.setInputValue("cfg-pt-m", S.state.ptM); S.setInputValue("cfg-pt-f", S.state.ptF);
    S.setInputValue("cfg-ltso-m", S.state.ltsoM); S.setInputValue("cfg-ltso-f", S.state.ltsoF);
    S.setInputValue("cfg-stso-m", S.state.stsoM); S.setInputValue("cfg-stso-f", S.state.stsoF);
    if (S.$("cfg-start")) S.$("cfg-start").value = S.toDateInputValue(S.state.startDate);
    var maxShiftNum = 0;
    S.state.shifts.forEach(function (s) { var m = /^S(\d+)$/.exec(String(s.id)); if (m) maxShiftNum = Math.max(maxShiftNum, Number(m[1])); });
    S.shiftSeq = Math.max(S.shiftSeq, maxShiftNum + 1);
    S.renderShiftsTable(); S.renderAll();
    S.updateStatus("Imported " + (S.state.lines.length ? "config and results" : "config only") + " · " + S.state.lines.length + " line(s).");
  };

  S.importJsonFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      try { S.applyPayload(JSON.parse(event.target.result)); }
      catch (err) { S.updateStatus("Import failed."); S.state.issues = ["Import failed: " + (err && err.message ? err.message : "Invalid JSON")]; S.renderIssues(); }
    };
    reader.readAsText(file);
  };

  S.clearAll = function () {
    S.state.lines = []; S.state.schedule = {}; S.state.issues = []; S.state.functionRotation = {}; S.state.mode = "—";
    S.renderAll(); S.updateStatus("Cleared results. Configuration remains.");
  };

  function loadScript(src, cb) {
    if (typeof ExcelJS !== "undefined") { cb(); return; }
    var s = document.createElement("script"); s.src = src; s.onload = cb;
    s.onerror = function () { if (S.updateStatus) S.updateStatus("Failed to load Excel library."); };
    document.head.appendChild(s);
  }
  function thinBlackBorder() {
    var edge = { style: "thin", color: { argb: "FF000000" } };
    return { top: edge, left: edge, bottom: edge, right: edge };
  }
  function applyBaseCell(cell, fillArgb, fontColor) {
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.font = { name: "Calibri", size: 11, color: { argb: fontColor || "FF000000" }, bold: false };
    cell.border = thinBlackBorder();
    if (fillArgb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
  }
  function dayDutyForExport(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    if (duty) return duty;
    if (line.function === "BAG" || line.function === "DFO" || line.function === "PAX") return line.function;
    return null;
  }
  function workLabelForLine(line, sh) {
    if (line.shiftLabel) return line.shiftLabel;
    if (sh && sh.start && sh.end) return sh.start + "–" + sh.end;
    if (sh && sh.start) return sh.start;
    return "WORK";
  }
  function exportPosition(line) {
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  }
  function exportEmpClass(line) {
    var pos = exportPosition(line);
    if (pos === "STSO" || pos === "LTSO") return "FT";
    return line.empClass === "PT" ? "PT" : "FT";
  }
  function teamMetaForExport(lineId) {
    if (S.teams && Array.isArray(S.teams.teams)) {
      var wantNum = +lineId, wantStr = String(lineId);
      for (var i = 0; i < S.teams.teams.length; i++) {
        var t = S.teams.teams[i], members = t.members || [];
        for (var j = 0; j < members.length; j++) {
          if (+members[j] === wantNum || String(members[j]) === wantStr) return { order: i, name: t.name || t.id, id: t.id };
        }
      }
    }
    return S.teamMetaForLine ? S.teamMetaForLine(lineId) : { order: 9999, name: "", id: "" };
  }
  function padTeamName(name) {
    var raw = String(name || "").trim(); if (!raw) return "";
    var m = raw.match(/^(\d+)$/); if (m) { var n = parseInt(m[1], 10); return n < 10 ? "0" + n : String(n); }
    return raw;
  }
  function teamNumberKey(teamMeta) {
    if (!teamMeta || !teamMeta.id) return 9999;
    var m = String(teamMeta.name || "").match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
    return teamMeta.order != null && teamMeta.order < 9999 ? teamMeta.order : 9999;
  }
  function roleSortKey(line) {
    var p = exportPosition(line); return p === "STSO" ? 0 : p === "LTSO" ? 1 : 2;
  }
  function sortLinesForExcel(lines) {
    return lines.slice().sort(function (a, b) {
      var ka = teamNumberKey(teamMetaForExport(a.id)), kb = teamNumberKey(teamMetaForExport(b.id));
      if (ka !== kb) return ka - kb;
      var ra = roleSortKey(a), rb = roleSortKey(b); if (ra !== rb) return ra - rb;
      var sa = S.getShift ? S.getShift(a.shiftId) : null, sb = S.getShift ? S.getShift(b.shiftId) : null;
      var sma = sa && S.timeToMin ? S.timeToMin(sa.start) : 0, smb = sb && S.timeToMin ? S.timeToMin(sb.start) : 0;
      if (sma !== smb) return sma - smb;
      return String(a.lineCode || a.id).localeCompare(String(b.lineCode || b.id), undefined, { numeric: true });
    });
  }

  var MODSET_COLORS = ["FF2A9D8F","FFE76F51","FF6A4C93","FF90BE6D","FFF4A261","FF457B9D","FFE9C46A","FFD62828","FF2D6A4F","FF9B5DE5","FF00BBF9","FFFB5607"];
  var TEAM_COLORS = ["FFBDE0FE","FFCDB4DB","FFA8DADC","FFFFC8DD","FFB5EAD7","FFFFDAC1","FFC7CEEA","FFE2F0CB","FFF8C8DC","FFD4A373","FF8ECAE6","FFFFD6A5"];
  function modSetColorMap() {
    var map = {};
    (S.listModSets ? S.listModSets() : []).forEach(function (ms, i) {
      map[String(ms.id)] = { argb: MODSET_COLORS[i % MODSET_COLORS.length], name: ms.name, checkpoint: ms.checkpoint };
    });
    return map;
  }
  function teamColorMap(lines) {
    var map = {}, i = 0;
    lines.forEach(function (line) {
      var key = padTeamName((teamMetaForExport(line.id).name || teamMetaForExport(line.id).id || ""));
      if (!key || map[key]) return;
      map[key] = TEAM_COLORS[i++ % TEAM_COLORS.length];
    });
    return map;
  }
  function lineModSetId(line) {
    if (line.modSetId != null) return line.modSetId;
    var tm = teamMetaForExport(line.id);
    if (S.teams && S.teams.teams) {
      for (var i = 0; i < S.teams.teams.length; i++) {
        if (S.teams.teams[i].id === tm.id) return S.teams.teams[i].modSetId;
      }
    }
    return null;
  }

  function generateAndDownloadXlsx() {
    var lines = S.state.lines || [];
    if (!lines.length) { if (S.updateStatus) S.updateStatus("No lines to export."); return; }
    if (S.collectTeamPool) S.collectTeamPool();
    lines = sortLinesForExcel(lines);
    var msMap = modSetColorMap();
    var tmMap = teamColorMap(lines);
    var days = 7;
    var dayNames = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var metaHeaders = ["Team", "Line", "Shift", "Start", "End", "Position", "Emp", "Sex", "Function", "RDOs", "Paid"];
    var headers = metaHeaders.concat(dayNames, ["Hours"]);
    var workbook = new ExcelJS.Workbook();
    workbook.creator = "BrokeSched";
    var sheet = workbook.addWorksheet("Lines");
    var tableRows = []; var rowMeta = [];
    lines.forEach(function (line) {
      var teamMeta = teamMetaForExport(line.id);
      var teamName = padTeamName(teamMeta.name || "");
      var sh = S.getShift ? S.getShift(line.shiftId) : null;
      var rdo = S.rdoTextForLine ? S.rdoTextForLine(line) : "";
      var hours = 0, dayValues = [], dayFlags = [], workText = workLabelForLine(line, sh);
      for (var i = 0; i < days; i++) {
        var sched = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
        var isWork = (sched[i] || "RDO") === "WORK";
        var duty = isWork ? dayDutyForExport(line, i) : null;
        var isBag = isWork && (duty === "BAG" || duty === "BAGS");
        var isDfo = isWork && duty === "DFO";
        if (isWork) hours += line.paid || 0;
        dayValues.push(isWork ? workText : "RDO");
        var msId = lineModSetId(line);
        var modFill = (isWork && !isBag && msId != null && msMap[String(msId)]) ? msMap[String(msId)].argb : null;
        dayFlags.push({ isRdo: !isWork, isBag: isBag, isDfo: isDfo, modFill: modFill });
      }
      tableRows.push([teamName, line.lineCode || "", line.shiftName || (sh && sh.name) || "", sh ? sh.start : "", sh ? sh.end : "", exportPosition(line), exportEmpClass(line), line.sex || "", line.function || "", rdo, line.paid || ""].concat(dayValues, [hours]));
      rowMeta.push({ days: dayFlags, teamFill: teamName ? tmMap[teamName] : null });
    });
    sheet.addRow(headers);
    tableRows.forEach(function (r) { sheet.addRow(r); });
    var lastCol = headers.length, lastRow = tableRows.length + 1;
    var headerFill = "FF1F4E79", zebraLight = "FFFFFFFF", zebraGrey = "FFEDEDED";
    var rdoFill = "FF000000", bagFill = "FFF4B4B4", dfoFill = "FFFFF3A8";
    var headerRow = sheet.getRow(1); headerRow.height = 22;
    for (var c = 1; c <= lastCol; c++) {
      var hc = headerRow.getCell(c);
      applyBaseCell(hc, headerFill, "FFFFFFFF"); hc.font.bold = true;
    }
    for (var r = 2; r <= lastRow; r++) {
      var row = sheet.getRow(r); row.height = 18;
      var stripe = (r % 2 === 0) ? zebraLight : zebraGrey;
      var meta = rowMeta[r - 2] || {}; var flags = meta.days || [];
      for (var col = 1; col <= lastCol; col++) {
        var cell = row.getCell(col);
        var dayOffset = col - (metaHeaders.length + 1);
        var isDayCol = dayOffset >= 0 && dayOffset < days;
        if (isDayCol && flags[dayOffset] && flags[dayOffset].isRdo) { applyBaseCell(cell, rdoFill, "FFFFFFFF"); cell.font.bold = true; }
        else if (isDayCol && flags[dayOffset] && flags[dayOffset].isBag) { applyBaseCell(cell, bagFill, "FF000000"); cell.font.bold = true; }
        else if (isDayCol && flags[dayOffset] && !flags[dayOffset].isRdo) {
          applyBaseCell(cell, flags[dayOffset].modFill || (flags[dayOffset].isDfo ? dfoFill : stripe), "FF000000"); cell.font.bold = true;
        } else if (col === 1 && meta.teamFill) { applyBaseCell(cell, meta.teamFill, "FF000000"); cell.font.bold = true; }
        else applyBaseCell(cell, stripe, "FF000000");
      }
    }
    sheet.columns.forEach(function (col, idx) { col.width = headers[idx] === "RDOs" ? 14 : headers[idx] === "Line" ? 12 : 10; });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: lastCol } };
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: "1:1" };
    sheet.views = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];
    var kr = lastRow + 2;
    sheet.getCell(kr, 1).value = "KEY"; applyBaseCell(sheet.getCell(kr, 1), headerFill, "FFFFFFFF"); kr++;
    sheet.getCell(kr, 1).value = "RDO"; applyBaseCell(sheet.getCell(kr, 1), rdoFill, "FFFFFFFF");
    sheet.getCell(kr, 2).value = "Regular day off"; applyBaseCell(sheet.getCell(kr, 2), "FFFFFFFF", "FF000000"); kr++;
    sheet.getCell(kr, 1).value = "BAG"; applyBaseCell(sheet.getCell(kr, 1), bagFill, "FF000000");
    sheet.getCell(kr, 2).value = "Baggage (not a mod set)"; applyBaseCell(sheet.getCell(kr, 2), "FFFFFFFF", "FF000000"); kr++;
    Object.keys(msMap).forEach(function (id) {
      var info = msMap[id];
      sheet.getCell(kr, 1).value = info.name; applyBaseCell(sheet.getCell(kr, 1), info.argb, "FF000000");
      sheet.getCell(kr, 2).value = "Mod set · " + (info.checkpoint || ""); applyBaseCell(sheet.getCell(kr, 2), "FFFFFFFF", "FF000000"); kr++;
    });
    return workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a"); var url = URL.createObjectURL(blob);
      a.href = url; a.download = "scheduler-lines-" + (S.dj ? S.dj().format("YYYY-MM-DD") : "export") + ".xlsx";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      if (S.updateStatus) S.updateStatus("Exported styled Excel (.xlsx) lines table.");
    });
  }

  S.exportLinesExcel = function () {
    if (!(S.state.lines || []).length) { if (S.updateStatus) S.updateStatus("No lines to export. Generate first."); return; }
    function run() {
      try {
        if (typeof ExcelJS === "undefined") throw new Error("ExcelJS not loaded");
        var p = generateAndDownloadXlsx();
        if (p && p.catch) p.catch(function (err) { if (S.updateStatus) S.updateStatus("Excel export failed: " + (err && err.message ? err.message : err)); });
      } catch (err) { if (S.updateStatus) S.updateStatus("Excel export failed: " + (err && err.message ? err.message : err)); }
    }
    if (typeof ExcelJS === "undefined") loadScript("lib/exceljs.min.js?v=20260902h", run); else run();
  };
})(window.Scheduler);

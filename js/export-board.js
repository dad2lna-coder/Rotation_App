/** Board export — same people as Lines Excel, day cells are location */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var MODSET_COLORS = ["FF2A9D8F","FFE76F51","FF6A4C93","FF90BE6D","FFF4A261","FF457B9D","FFE9C46A","FFD62828","FF2D6A4F","FF9B5DE5","FF00BBF9","FFFB5607"];
  var TEAM_COLORS = ["FFBDE0FE","FFCDB4DB","FFA8DADC","FFFFC8DD","FFB5EAD7","FFFFDAC1","FFC7CEEA","FFE2F0CB"];

  function border() {
    var e = { style: "thin", color: { argb: "FF000000" } };
    return { top: e, left: e, bottom: e, right: e };
  }
  function paint(cell, fill, font) {
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.font = { name: "Calibri", size: 11, color: { argb: font || "FF000000" }, bold: true };
    cell.border = border();
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  function pos(line) {
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  }
  function teamMeta(lineId) {
    if (S.teams && S.teams.teams) {
      for (var i = 0; i < S.teams.teams.length; i++) {
        var t = S.teams.teams[i], m = t.members || [];
        for (var j = 0; j < m.length; j++) {
          if (String(m[j]) === String(lineId)) return { name: t.name || t.id, id: t.id, order: i };
        }
      }
    }
    return { name: "", id: "", order: 9999 };
  }
  function msList() { return S.listModSets ? S.listModSets() : []; }
  function msRec(id) {
    var rec = null;
    msList().forEach(function (s, i) {
      if (String(s.id) === String(id)) rec = { name: s.name, checkpoint: s.checkpoint, argb: MODSET_COLORS[i % MODSET_COLORS.length] };
    });
    return rec;
  }
  function msIdFor(line, team, day) {
    if (team && S.modSetForTeamDay) {
      var d = S.modSetForTeamDay(team.id, day);
      if (d != null) return d;
    }
    return line.modSetId != null ? line.modSetId : (team && team.modSetId);
  }
  function duty(line, day) {
    var d = S.getRotationDuty ? S.getRotationDuty(line.id, day) : null;
    return d || line.function || null;
  }
  function label(line, team, day, isWork) {
    if (!isWork) return "RDO";
    var du = duty(line, day);
    if (du === "BAG" || du === "BAGS") return "BAG";
    var rec = msRec(msIdFor(line, team, day));
    var name = rec ? rec.name : "";
    if (du === "DFO" && name) return "DFO " + name;
    if (du === "DFO") return "DFO";
    return name || "WORK";
  }

  S.exportBoardExcel = function () {
    var lines = (S.state.lines || []).slice();
    if (!lines.length) {
      if (S.updateStatus) S.updateStatus("No lines to export. Generate first.");
      return;
    }
    function run() {
      if (typeof ExcelJS === "undefined") throw new Error("ExcelJS not loaded");
      lines.sort(function (a, b) {
        var ta = teamMeta(a.id), tb = teamMeta(b.id);
        var na = String(ta.name || "zzz"), nb = String(tb.name || "zzz");
        if (na !== nb) return na.localeCompare(nb, undefined, { numeric: true });
        return String(a.lineCode || a.id).localeCompare(String(b.lineCode || b.id), undefined, { numeric: true });
      });
      var dayNames = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      var headerFill = "FF1F4E79", rdoFill = "FF000000", bagFill = "FFF4B4B4", dfoFill = "FFFFF3A8";
      var wb = new ExcelJS.Workbook();
      wb.creator = "BrokeSched";
      var board = wb.addWorksheet("Board");
      var heads = ["Team", "Line", "Shift", "Start", "End", "Position", "Sex", "Function"].concat(dayNames);
      board.addRow(heads);
      for (var c = 1; c <= heads.length; c++) {
        paint(board.getRow(1).getCell(c), headerFill, "FFFFFFFF");
      }
      var counts = {};
      function bump(day, key) {
        if (!counts[key]) counts[key] = [0, 0, 0, 0, 0, 0, 0];
        counts[key][day] += 1;
      }
      var teamColorAt = {};
      var tci = 0;
      lines.forEach(function (line, li) {
        var tm = teamMeta(line.id);
        if (tm.name && !teamColorAt[tm.name]) teamColorAt[tm.name] = TEAM_COLORS[tci++ % TEAM_COLORS.length];
        var sh = S.getShift ? S.getShift(line.shiftId) : null;
        var row = [tm.name || "", line.lineCode || line.id, (line.shiftName || (sh && sh.name) || ""), sh ? sh.start : "", sh ? sh.end : "", pos(line), line.sex || "", line.function || ""];
        var flags = [];
        for (var d = 0; d < 7; d++) {
          var sched = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
          var isWork = (sched[d] || "RDO") === "WORK";
          var du = isWork ? duty(line, d) : null;
          var isBag = du === "BAG" || du === "BAGS";
          var isDfo = du === "DFO";
          var lab = label(line, tm.id ? tm : null, d, isWork);
          row.push(lab);
          var rec = msRec(msIdFor(line, tm.id ? tm : null, d));
          flags.push({ isRdo: !isWork, isBag: isBag, isDfo: isDfo, fill: rec ? rec.argb : null });
          if (!isWork) bump(d, "RDO");
          else if (isBag) bump(d, "BAG");
          else {
            bump(d, rec ? rec.name : "UNASSIGNED");
            if (isDfo) bump(d, "DFO");
          }
        }
        board.addRow(row);
        var er = board.getRow(li + 2);
        er.height = 18;
        for (var col = 1; col <= row.length; col++) {
          var cell = er.getCell(col);
          var off = col - 9;
          if (off >= 0 && off < 7) {
            if (flags[off].isRdo) paint(cell, rdoFill, "FFFFFFFF");
            else if (flags[off].isBag) paint(cell, bagFill, "FF000000");
            else if (flags[off].isDfo) paint(cell, dfoFill, "FF000000");
            else paint(cell, flags[off].fill || "FFFFFFFF", "FF000000");
          } else if (col === 1 && tm.name && teamColorAt[tm.name]) paint(cell, teamColorAt[tm.name], "FF000000");
          else paint(cell, "FFFFFFFF", "FF000000");
        }
      });
      board.columns.forEach(function (col, i) { col.width = i === 1 ? 14 : 12; });
      board.views = [{ state: "frozen", ySplit: 1 }];
      board.autoFilter = { from: { row: 1, column: 1 }, to: { row: lines.length + 1, column: heads.length } };

      var cs = wb.addWorksheet("Counts");
      var ch = ["Location"].concat(dayNames).concat(["Total"]);
      cs.addRow(ch);
      for (var c = 1; c <= ch.length; c++) paint(cs.getRow(1).getCell(c), headerFill, "FFFFFFFF");
      Object.keys(counts).sort().forEach(function (k, ki) {
        var arr = counts[k], tot = 0;
        arr.forEach(function (n) { tot += n; });
        cs.addRow([k].concat(arr, [tot]));
        var row = cs.getRow(ki + 2);
        for (var c = 1; c <= ch.length; c++) paint(row.getCell(c), "FFFFFFFF", "FF000000");
      });
      cs.columns.forEach(function (col) { col.width = 14; });

      return wb.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        var a = document.createElement("a");
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = "scheduler-board-" + (S.dj ? S.dj().format("YYYY-MM-DD") : "export") + ".xlsx";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (S.updateStatus) S.updateStatus("Exported Board + Counts (.xlsx).");
      });
    }
    try {
      if (typeof ExcelJS === "undefined") {
        var s = document.createElement("script");
        s.src = "lib/exceljs.min.js?v=20260902i";
        s.onload = function () { run(); };
        document.head.appendChild(s);
      } else run();
    } catch (err) {
      if (S.updateStatus) S.updateStatus("Board export failed: " + (err && err.message ? err.message : err));
    }
  };

  function hook() {
    var btn = document.getElementById("btn-export-lines-excel");
    if (btn && !btn._boardHooked) {
      btn._boardHooked = true;
      btn.addEventListener("click", function () {
        setTimeout(function () { S.exportBoardExcel(); }, 50);
      });
    }
  }
  document.addEventListener("DOMContentLoaded", hook);
  hook();
})(window.Scheduler);

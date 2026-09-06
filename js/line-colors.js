/** Paint RDO black / BAG red / DFO yellow on the Lines tab */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function dutyFor(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    if (duty) return duty;
    return line.function || null;
  }
  function workLabel(line) {
    if (line.shiftLabel) return line.shiftLabel;
    var sh = S.getShift ? S.getShift(line.shiftId) : null;
    if (sh && sh.start && sh.end) return sh.start + "\u2013" + sh.end;
    if (sh && sh.start) return sh.start;
    return "WORK";
  }
  function applyBagDutyToWorkDays(line) {
    if (!line || line.function !== "BAG") return;
    if (!S.state.functionRotation) S.state.functionRotation = {};
    var key = String(line.id);
    if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
    var sched = S.state.schedule[line.id] || S.state.schedule[key] || [];
    var days = Math.max(sched.length, (S.state.weekCount || 1) * 7);
    for (var i = 0; i < days; i++) {
      while (S.state.functionRotation[key].length <= i) S.state.functionRotation[key].push(null);
      if (sched[i] === "WORK") S.state.functionRotation[key][i] = "BAG";
    }
  }
  function applyDfoDutyToWorkDays(line) {
    if (!line || line.function !== "DFO") return;
    if (!S.state.functionRotation) S.state.functionRotation = {};
    var key = String(line.id);
    if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
    var sched = S.state.schedule[line.id] || S.state.schedule[key] || [];
    var days = Math.max(sched.length, (S.state.weekCount || 1) * 7);
    for (var i = 0; i < days; i++) {
      while (S.state.functionRotation[key].length <= i) S.state.functionRotation[key].push(null);
      if (sched[i] === "WORK") S.state.functionRotation[key][i] = "DFO";
    }
  }
  function paintLinesTable() {
    var tbody = document.getElementById("lines-tbody");
    if (!tbody) return;
    tbody.querySelectorAll("td.cell-toggle").forEach(function (cell) {
      var line = S.findLineById ? S.findLineById(cell.getAttribute("data-line-id")) : null;
      var day = +cell.getAttribute("data-day");
      if (!line || isNaN(day)) return;
      var sched = (S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[day] || "RDO";
      cell.style.background = "";
      cell.style.color = "";
      if (sched !== "WORK") {
        cell.className = "cell-rdo cell-toggle";
        cell.textContent = "RDO";
        cell.style.background = "#000";
        cell.style.color = "#fff";
        cell.style.opacity = "1";
        return;
      }
      var duty = dutyFor(line, day);
      var isBag = duty === "BAG" || duty === "BAGS";
      var isDfo = duty === "DFO";
      var extra = "";
      if (isBag) extra = " cell-function-duty cell-bag";
      else if (isDfo) extra = " cell-function-duty cell-dfo";
      cell.className = "cell-work cell-toggle" + extra;
      cell.textContent = workLabel(line);
    });
  }
  S.paintLineColors = paintLinesTable;
  function wrap(name) {
    var orig = S[name];
    if (typeof orig !== "function" || orig._lineColorsWrapped) return;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      setTimeout(paintLinesTable, 0);
      return result;
    };
    wrapped._lineColorsWrapped = true;
    S[name] = wrapped;
  }
  wrap("renderLines");
  wrap("renderAll");
  wrap("generateFunctionAssignments");
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.getAttribute("data-field") !== "function") return;
    var line = S.findLineById ? S.findLineById(t.getAttribute("data-line-id")) : null;
    if (!line) return;
    line.function = t.value === "DFO" || t.value === "PAX" || t.value === "BAG" ? t.value : "";
    if (line.function === "BAG") applyBagDutyToWorkDays(line);
    if (line.function === "DFO") applyDfoDutyToWorkDays(line);
    if (S.renderLines) S.renderLines();
    else paintLinesTable();
  });
  document.addEventListener("DOMContentLoaded", function () {
    wrap("renderLines");
    wrap("renderAll");
    wrap("generateFunctionAssignments");
    paintLinesTable();
  });
})(window.Scheduler);

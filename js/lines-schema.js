/** Canonical line fields for F7 rotation.
 * Emp = FT|PT
 * Position = STSO|LTSO|TSO  (counts + rotation title)
 * Function / functionRotation[day] = PAX|DFO|BAG
 * Line = display name on the rotation sheet
 */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.linePosition = function (line) {
    if (!line) return "TSO";
    if (line.position === "STSO" || line.position === "LTSO" || line.position === "TSO") return line.position;
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  };

  S.lineEmpOnly = function (line) {
    if (!line) return "FT";
    if (line.empClass === "PT") return "PT";
    if (line.empClass === "FT") return "FT";
    return "FT";
  };

  S.normalizeLineRoles = function (line) {
    if (!line) return line;
    var pos = S.linePosition(line);
    line.position = pos;
    line.isStso = pos === "STSO";
    line.isLtso = pos === "LTSO";
    if (line.empClass === "STSO" || line.empClass === "LTSO" || line.empClass === "TSO") line.empClass = "FT";
    if (line.empClass !== "PT") line.empClass = line.empClass === "PT" ? "PT" : "FT";
    return line;
  };

  S.normalizeAllLineRoles = function () {
    (S.state.lines || []).forEach(S.normalizeLineRoles);
  };

  S.applyLinePosition = function (line, pos) {
    pos = pos === "STSO" || pos === "LTSO" ? pos : "TSO";
    line.position = pos;
    line.isStso = pos === "STSO";
    line.isLtso = pos === "LTSO";
    if (line.empClass === "STSO" || line.empClass === "LTSO") line.empClass = "FT";
  };

  var origApplyEmp = S.applyLineEmp;
  S.applyLineEmp = function (line, emp) {
    if (emp === "STSO" || emp === "LTSO" || emp === "TSO") {
      S.applyLinePosition(line, emp);
      if (!line.empClass || line.empClass === "STSO" || line.empClass === "LTSO") line.empClass = "FT";
      return;
    }
    line.empClass = emp === "PT" ? "PT" : "FT";
    if (origApplyEmp && emp !== "STSO" && emp !== "LTSO") {
      /* keep flags from position, not emp */
    }
  };

  var origRole = S.lineRoleKey;
  S.lineRoleKey = function (line) {
    return S.linePosition(line);
  };

  S.lineDutySummary = function (line) {
    var rot = (S.state.functionRotation || {})[String(line.id)] || [];
    var seen = [];
    rot.forEach(function (d) {
      if (d && seen.indexOf(d) === -1) seen.push(d);
    });
    if (!seen.length && line.function) seen.push(line.function);
    return seen.join(",");
  };

  S.syncLineFunctionFromRotation = function (line) {
    var sum = S.lineDutySummary(line);
    if (sum.indexOf("DFO") !== -1) line.function = line.function === "BAG" ? line.function : (line.function || "DFO");
    if (sum === "DFO") line.function = "DFO";
    if (sum === "BAG") line.function = "BAG";
    if (sum.indexOf("DFO") !== -1 && !line.function) line.function = "DFO";
  };

  function wrapRender() {
    if (!S.renderLines || S.renderLines._schema) return;
    var orig = S.renderLines;
    S.renderLines = function () {
      S.normalizeAllLineRoles();
      orig.apply(this, arguments);
      patchHeader();
      patchRows();
    };
    S.renderLines._schema = true;
  }

  function patchHeader() {
    var thead = S.$("lines-thead");
    if (!thead) return;
    var tr = thead.querySelector("tr");
    if (!tr || tr.getAttribute("data-schema") === "1") return;
    var cells = tr.querySelectorAll("th");
    if (cells.length < 6) return;
    /* Team Line Shift Emp Sex Function … → insert Position after Emp */
    var empTh = cells[3];
    if (empTh) empTh.textContent = "Emp";
    var pos = document.createElement("th");
    pos.textContent = "Position";
    if (empTh && empTh.nextSibling) tr.insertBefore(pos, empTh.nextSibling);
    else tr.appendChild(pos);
    tr.setAttribute("data-schema", "1");
  }

  function patchRows() {
    document.querySelectorAll("#lines-tbody tr[data-line-row]").forEach(function (tr) {
      if (tr.querySelector('[data-field="position"]')) return;
      var id = tr.getAttribute("data-line-row");
      var line = S.findLineById ? S.findLineById(id) : null;
      if (!line) return;
      S.normalizeLineRoles(line);
      var empSel = tr.querySelector('[data-field="emp"]');
      if (empSel) {
        empSel.innerHTML =
          '<option value="FT"' + (S.lineEmpOnly(line) === "FT" ? " selected" : "") + ">FT</option>" +
          '<option value="PT"' + (S.lineEmpOnly(line) === "PT" ? " selected" : "") + ">PT</option>";
      }
      var posSel = document.createElement("select");
      posSel.className = "line-edit";
      posSel.setAttribute("data-field", "position");
      posSel.setAttribute("data-line-id", id);
      var pos = S.linePosition(line);
      ["STSO", "LTSO", "TSO"].forEach(function (p) {
        var o = document.createElement("option");
        o.value = p; o.textContent = p;
        if (p === pos) o.selected = true;
        posSel.appendChild(o);
      });
      var empTd = empSel ? empSel.parentNode : null;
      var td = document.createElement("td");
      td.appendChild(posSel);
      if (empTd && empTd.nextSibling) tr.insertBefore(td, empTd.nextSibling);
      else tr.appendChild(td);

      var fnSel = tr.querySelector('[data-field="function"]');
      if (fnSel) {
        var duty = S.lineDutySummary(line);
        if (duty && duty.indexOf("DFO") !== -1) fnSel.value = fnSel.value || "DFO";
        if (duty && !fnSel.value && duty.indexOf("BAG") !== -1) fnSel.value = "BAG";
        if (duty) fnSel.title = "Week duties: " + duty;
      }
    });
  }

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute("data-field") !== "position") return;
    var line = S.findLineById && S.findLineById(t.getAttribute("data-line-id"));
    if (!line) return;
    S.applyLinePosition(line, t.value);
    if (S.renderLines) S.renderLines();
    if (S.renderTeams) S.renderTeams();
    if (S.renderCoverageBars) S.renderCoverageBars();
  });

  var origGenFn = S.generateFunctionAssignments;
  if (typeof origGenFn === "function") {
    S.generateFunctionAssignments = function () {
      var out = origGenFn.apply(this, arguments);
      (S.state.lines || []).forEach(function (line) {
        var rot = (S.state.functionRotation || {})[String(line.id)] || [];
        var hasDfo = rot.some(function (d) { return d === "DFO"; });
        var hasBag = rot.some(function (d) { return d === "BAG"; });
        if (hasDfo) line.function = "DFO";
        else if (hasBag) line.function = "BAG";
        else if (!line.function) line.function = "PAX";
      });
      if (S.renderLines) S.renderLines();
      return out;
    };
  }

  function boot() {
    S.normalizeAllLineRoles();
    wrapRender();
    if (S.renderLines) S.renderLines();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.Scheduler);

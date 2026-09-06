/** Management reports — deviation tables + gender balance analysis */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.reportsView = S.reportsView || {
    which: "passenger", // passenger | baggage | total | dfoPool
    skewThreshold: 5,
    phaseThresholdMin: 30
  };

  function emptyCell() {
    return {
      STSO: { M: 0, F: 0 },
      LTSO: { M: 0, F: 0 },
      TSO: { M: 0, F: 0 }
    };
  }

  function roleOf(line) {
    return S.lineRoleKey ? S.lineRoleKey(line) : "TSO";
  }

  /** Detailed headcount matrix: slots × 7 days × roles × sex */
  S.computeRoleMatrixByDow = function (opts) {
    opts = opts || {};
    var mode = opts.mode || "total"; // passenger | baggage | total | dfoPool
    var slots = S.coverageSlots();
    var base = S.state.startDate ? S.state.startDate : (S.parseStartDate ? S.parseStartDate(null) : null);
    var dowToOffset = {};
    var days = Math.min(7, (S.state.weekCount || 1) * 7);
    for (var off = 0; off < days; off++) {
      var dow;
      if (base && typeof base.add === "function") {
        dow = base.add(off, "day").day();
      } else if (base && base instanceof Date) {
        var dte = new Date(base.getTime());
        dte.setDate(dte.getDate() + off);
        dow = dte.getDay();
      } else {
        // Fallback: treat offset 0 as Sunday when no start date
        dow = off % 7;
      }
      if (dowToOffset[dow] == null) dowToOffset[dow] = off;
    }
    // Ensure all 7 days map somewhere for single-week schedules
    for (var d0 = 0; d0 < 7; d0++) {
      if (dowToOffset[d0] == null) dowToOffset[d0] = d0 % Math.max(1, days);
    }

    var matrix = slots.map(function () {
      return [0, 1, 2, 3, 4, 5, 6].map(function () {
        return emptyCell();
      });
    });

    S.state.lines.forEach(function (line) {
      if (!S.getShift(line.shiftId)) return;
      var role = roleOf(line);
      var sex = line.sex === "F" ? "F" : "M";

      if (mode === "dfoPool") {
        // Eligible pool only — count if certified DFO, for every WORK slot they cover
        var el = line.functionEligible || {};
        if (!el.dfo) return;
      }

      for (var dow = 0; dow < 7; dow++) {
        var off = dowToOffset[dow];
        if (off == null) continue;
        if ((S.state.schedule[line.id] || [])[off] !== "WORK") continue;

        if (mode === "baggage") {
          var rotMap = S.state.functionRotation || {};
          var rotRow = rotMap[line.id] || rotMap[String(line.id)];
          var duty = rotRow ? (rotRow[off] || null) : null;
          if (duty !== "BAG" && duty !== "DFO") continue; // baggage area = BAG + DFO
        } else if (mode === "passenger") {
          var rotMapP = S.state.functionRotation || {};
          var rotRowP = rotMapP[line.id] || rotMapP[String(line.id)];
          var dutyP = rotRowP ? (rotRowP[off] || null) : null;
          if (dutyP === "BAG" || dutyP === "DFO") continue;
        }

        var times = S.getEffectiveShiftTimes
          ? S.getEffectiveShiftTimes(line.shiftId, dow)
          : { start: S.getShift(line.shiftId).start, end: S.getShift(line.shiftId).end };
        var a = S.timeToMin(times.start);
        var b = S.timeToMin(times.end);
        slots.forEach(function (slot, si) {
          if (a < slot + 30 && b > slot) {
            matrix[si][dow][role][sex]++;
          }
        });
      }
    });
    return { slots: slots, matrix: matrix, dowToOffset: dowToOffset };
  };

  function cellKey(c) {
    return ["STSO", "LTSO", "TSO"]
      .map(function (r) {
        return r + ":" + c[r].M + "/" + c[r].F;
      })
      .join("|");
  }

  function formatCell(c) {
    var m = 0, f = 0;
    ["STSO", "LTSO", "TSO"].forEach(function (r) {
      if (!c[r]) return;
      m += c[r].M || 0;
      f += c[r].F || 0;
    });
    var tot = m + f;
    if (tot === 0) return "<span class=\"muted\">—</span>";
    var detail = "";
    ["STSO", "LTSO", "TSO"].forEach(function (r) {
      var rm = (c[r] && c[r].M) || 0;
      var rf = (c[r] && c[r].F) || 0;
      if (rm + rf === 0) return;
      detail +=
        "<div class=\"rpt-role\"><span class=\"rpt-role-lbl\">" + r + "</span> " +
        "<span class=\"sex-m\">" + rm + "</span>/" +
        "<span class=\"sex-f\">" + rf + "</span></div>";
    });
    return (
      "<div class=\"rpt-total\"><strong>" + tot + "</strong> " +
      "(<span class=\"sex-m\">" + m + "</span>/<span class=\"sex-f\">" + f + "</span>)</div>" +
      detail
    );
  }

  S.compressDeviationRows = function (slots, matrix) {
    var rows = [];
    var prevKey = null;
    var runStart = null;
    for (var si = 0; si < slots.length; si++) {
      var key = matrix[si].map(cellKey).join(";");
      if (key !== prevKey) {
        if (prevKey != null) {
          rows.push({
            startSlot: runStart,
            endSlot: slots[si],
            cells: matrix[si - 1]
          });
        }
        runStart = slots[si];
        prevKey = key;
      }
    }
    if (prevKey != null && runStart != null) {
      rows.push({
        startSlot: runStart,
        endSlot: slots[slots.length - 1] + 30,
        cells: matrix[matrix.length - 1]
      });
    }
    return rows;
  };

  S.renderDeviationReport = function (containerId, mode, title) {
    var el = S.$(containerId);
    if (!el) return;
    if (!S.state.lines.length) {
      el.innerHTML = '<p class="muted">Generate a schedule first.</p>';
      return;
    }
    var computed = S.computeRoleMatrixByDow({ mode: mode });
    var rows = S.compressDeviationRows(computed.slots, computed.matrix);
    if (!rows.length) {
      el.innerHTML = "<h3 class=\"section-title\">" + title + "</h3><p class=\"muted\">No scheduled headcount for this view. Generate lines and function assignments first.</p>";
      return;
    }
    var html =
      "<h3 class=\"section-title\">" +
      title +
      "</h3>" +
      '<div class="lines-scroll"><table class="data-table rpt-table"><thead><tr><th>Window</th>';
    for (var d = 0; d < 7; d++) html += "<th>" + (S.DAYS[d] || d) + "</th>";
    html += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html +=
        "<tr><td>" +
        S.slotLabel(r.startSlot) +
        "–" +
        S.slotLabel(r.endSlot % 1440) +
        "</td>";
      for (var d = 0; d < 7; d++) {
        html += "<td>" + formatCell(r.cells[d]) + "</td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    el.innerHTML = html;
  };

  /** Dynamic AM/PM anchors from shift start distribution */
  S.computeShiftAnchors = function () {
    var starts = {};
    (S.state.lines || []).forEach(function (l) {
      var sh = S.getShift(l.shiftId);
      if (!sh) return;
      var m = S.timeToMin(sh.start);
      starts[m] = (starts[m] || 0) + 1;
    });
    var entries = Object.keys(starts)
      .map(function (k) {
        return { min: +k, n: starts[k] };
      })
      .sort(function (a, b) {
        return a.min - b.min;
      });
    if (!entries.length) return { am: 8 * 60, pm: 14 * 60 };
    // AM anchor = largest cluster in morning (before noon)
    var am = entries[0].min;
    var amN = 0;
    entries.forEach(function (e) {
      if (e.min < 12 * 60 && e.n > amN) {
        amN = e.n;
        am = e.min;
      }
    });
    // PM anchor = largest cluster at/after noon
    var pm = entries[entries.length - 1].min;
    var pmN = 0;
    entries.forEach(function (e) {
      if (e.min >= 12 * 60 && e.n > pmN) {
        pmN = e.n;
        pm = e.min;
      }
    });
    return { am: am, pm: pm };
  };

  S.phaseOfStart = function (startMin, anchors, threshold) {
    threshold = threshold != null ? threshold : 30;
    if (startMin <= anchors.am - threshold && startMin < 11 * 60) return "Opening";
    if (startMin < anchors.pm - threshold) return "AM";
    if (startMin <= anchors.pm + threshold) return "PM";
    return "Closing";
  };

  S.renderGenderBalanceReports = function () {
    var el = S.$("report-gender");
    if (!el) return;
    if (!S.state.lines.length) {
      el.innerHTML = '<p class="muted">Generate a schedule first.</p>';
      return;
    }
    var thr = S.reportsView.phaseThresholdMin || 30;
    var skewThr = S.reportsView.skewThreshold || 5;
    var anchors = S.computeShiftAnchors();

    var totalM = 0;
    var totalF = 0;
    S.state.lines.forEach(function (l) {
      if (l.sex === "F") totalF++;
      else totalM++;
    });
    var overallFPct = totalM + totalF ? Math.round((100 * totalF) / (totalM + totalF)) : 0;

    // Part A: phase × day gender %
    var phases = ["Opening", "AM", "PM", "Closing"];
    var phaseDay = {};
    phases.forEach(function (p) {
      phaseDay[p] = [0, 1, 2, 3, 4, 5, 6].map(function () {
        return { M: 0, F: 0 };
      });
    });

    var base = S.state.startDate ? S.state.startDate : (S.parseStartDate ? S.parseStartDate(null) : null);
    var dowToOffset = {};
    var days = Math.min(7, (S.state.weekCount || 1) * 7);
    for (var off = 0; off < days; off++) {
      var dow;
      if (base && typeof base.add === "function") dow = base.add(off, "day").day();
      else dow = off % 7;
      if (dowToOffset[dow] == null) dowToOffset[dow] = off;
    }
    for (var d0 = 0; d0 < 7; d0++) {
      if (dowToOffset[d0] == null) dowToOffset[d0] = d0 % Math.max(1, days);
    }

    S.state.lines.forEach(function (l) {
      var sh = S.getShift(l.shiftId);
      if (!sh) return;
      var phase;
      if (sh.phase && sh.phase !== "auto") {
        var map = { opening: "Opening", am: "AM", pm: "PM", closing: "Closing" };
        phase = map[sh.phase] || "AM";
      } else {
        phase = S.phaseOfStart(S.timeToMin(sh.start), anchors, thr);
      }
      var sex = l.sex === "F" ? "F" : "M";
      for (var dow = 0; dow < 7; dow++) {
        var off = dowToOffset[dow];
        if (off == null) continue;
        if ((S.state.schedule[l.id] || [])[off] !== "WORK") continue;
        phaseDay[phase][dow][sex]++;
      }
    });

    var html =
      '<h3 class="section-title">Gender balance by shift phase</h3>' +
      '<p class="muted">AM anchor ' +
      S.slotLabel(anchors.am) +
      " · PM anchor " +
      S.slotLabel(anchors.pm) +
      " · threshold ±" +
      thr +
      " min · overall F% " +
      overallFPct +
      " · skew flag &gt;" +
      skewThr +
      " pts</p>" +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Phase</th>';
    for (var d = 0; d < 7; d++) html += "<th>" + S.DAYS[d] + "</th>";
    html += "</tr></thead><tbody>";
    phases.forEach(function (p) {
      html += "<tr><td><strong>" + p + "</strong></td>";
      for (var d = 0; d < 7; d++) {
        var cell = phaseDay[p][d];
        var t = cell.M + cell.F;
        var fPct = t ? Math.round((100 * cell.F) / t) : 0;
        var skew = Math.abs(fPct - overallFPct) > skewThr;
        html +=
          "<td class=\"" +
          (skew ? "hc-high" : "") +
          '">' +
          fPct +
          "% F" +
          (skew ? " ⚠" : "") +
          " <span class=\"muted\">(" +
          cell.M +
          "M/" +
          cell.F +
          "F)</span></td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table></div>";

    // Part B: DFO AM/PM
    var dfoAM = { M: 0, F: 0 };
    var dfoPM = { M: 0, F: 0 };
    S.state.lines.forEach(function (l) {
      var elig = l.functionEligible || {};
      if (!elig.dfo) return;
      var sh = S.getShift(l.shiftId);
      if (!sh) return;
      var start = S.timeToMin(sh.start);
      var sex = l.sex === "F" ? "F" : "M";
      var thr = (S.state.functionCoverage && S.state.functionCoverage.phaseThresholdMin) || 15;
      if (S.isAmSide ? S.isAmSide(start, anchors, thr) : start < anchors.pm) dfoAM[sex]++;
      else dfoPM[sex]++;
    });
    function pctF(b) {
      var t = b.M + b.F;
      return t ? Math.round((100 * b.F) / t) : 0;
    }
    html +=
      '<h3 class="section-title" style="margin-top:1rem">DFO certified pool by AM/PM</h3>' +
      '<table class="data-table"><thead><tr><th>Window</th><th>Male</th><th>Female</th><th>F%</th></tr></thead><tbody>' +
      "<tr><td>AM (start before " +
      S.slotLabel(anchors.pm) +
      ")</td><td>" +
      dfoAM.M +
      "</td><td>" +
      dfoAM.F +
      "</td><td>" +
      pctF(dfoAM) +
      "%</td></tr>" +
      "<tr><td>PM (start at/after " +
      S.slotLabel(anchors.pm) +
      ")</td><td>" +
      dfoPM.M +
      "</td><td>" +
      dfoPM.F +
      "</td><td>" +
      pctF(dfoPM) +
      "%</td></tr></tbody></table>";

    // Part C: RDO equity
    var rdoM = [0, 0, 0, 0, 0, 0, 0];
    var rdoF = [0, 0, 0, 0, 0, 0, 0];
    S.state.lines.forEach(function (l) {
      var arr = l.sex === "F" ? rdoF : rdoM;
      (l.rdoDays || []).forEach(function (d) {
        if (d >= 0 && d <= 6) arr[d]++;
      });
    });
    html +=
      '<h3 class="section-title" style="margin-top:1rem">RDO pattern equity by gender</h3>' +
      '<table class="data-table"><thead><tr><th>Sex</th>';
    for (var d = 0; d < 7; d++) html += "<th>" + S.DAYS[d] + "</th>";
    html += "<th>Total</th></tr></thead><tbody>";
    function rdoRow(label, arr) {
      var sum = arr.reduce(function (a, b) { return a + b; }, 0);
      var row = "<tr><td><strong>" + label + "</strong></td>";
      arr.forEach(function (n) {
        row += "<td>" + n + (sum ? " <span class=\"muted\">(" + Math.round((100 * n) / sum) + "%)</span>" : "") + "</td>";
      });
      row += "<td>" + sum + "</td></tr>";
      return row;
    }
    html += rdoRow("Male", rdoM) + rdoRow("Female", rdoF) + "</tbody></table>";
    el.innerHTML = html;
  };

  S.renderReports = function () {
    var which = S.reportsView.which || "passenger";
    var map = {
      passenger: ["report-main", "passenger", "Passenger coverage"],
      baggage: ["report-main", "baggage", "Baggage / DFO duty coverage"],
      total: ["report-main", "total", "Total coverage (everybody)"],
      dfoPool: ["report-main", "dfoPool", "DFO allocated pool (certified)"]
    };
    var cfg = map[which] || map.passenger;
    S.renderDeviationReport(cfg[0], cfg[1], cfg[2]);
    S.renderGenderBalanceReports();
  };

  S.initReports = function () {
    if (S._reportsBound) return;
    S._reportsBound = true;
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.name === "report-which") {
        S.reportsView.which = t.value;
        S.renderReports();
      }
      if (t.id === "report-skew-thr") {
        S.reportsView.skewThreshold = Math.max(1, +t.value || 5);
        S.renderReports();
      }
      if (t.id === "report-phase-thr") {
        S.reportsView.phaseThresholdMin = Math.max(0, +t.value || 30);
        S.renderReports();
      }
    });
  };
})(window.Scheduler);

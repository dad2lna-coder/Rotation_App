/** Rendering — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.dayLabel = function (offset) {
    var base = S.state.startDate ? S.state.startDate : S.parseStartDate(null);
    var d = base.add(offset, "day");
    return S.DAYS[d.day()] + " " + (d.month() + 1) + "/" + d.date();
  };

  /** Build 30-minute slot list (minutes from midnight) covering open→close */
  S.coverageSlots = function () {
    var openMin = S.timeToMin(S.state.open);
    var closeMin = S.timeToMin(S.state.close);
    // Align to 30-min grid
    var start = Math.floor(openMin / 30) * 30;
    var end = Math.ceil(closeMin / 30) * 30;
    var slots = [];
    for (var m = start; m < end; m += 30) slots.push(m);
    return slots;
  };

  S.slotLabel = function (mins) {
    var h = Math.floor(mins / 60);
    var mm = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  };

  S.coverageView = S.coverageView || {
    stso: false,
    ltso: false,
    tso: true,
    funcView: "all" // all | bag | pax
  };

  S.computeHourlyByDow = function () {
    var slots = S.coverageSlots();
    var cv = S.coverageView || { stso: false, ltso: false, tso: true, funcView: "all" };
    var base = S.state.startDate ? S.state.startDate : S.parseStartDate(null);
    var dowToOffset = {};
    var days = Math.min(7, (S.state.weekCount || 1) * 7);
    for (var off = 0; off < days; off++) {
      var dt = base.add(off, "day");
      var dow = dt.day();
      if (dowToOffset[dow] == null) dowToOffset[dow] = off;
    }

    var matrix = slots.map(function () {
      return [0, 1, 2, 3, 4, 5, 6].map(function () {
        return { m: 0, f: 0, t: 0 };
      });
    });

    function roleOk(line) {
      var role = S.lineRoleKey ? S.lineRoleKey(line) : "TSO";
      if (role === "STSO") return !!cv.stso;
      if (role === "LTSO") return !!cv.ltso;
      return !!cv.tso;
    }

    function funcOk(line, dayOff) {
      var fv = cv.funcView || "all";
      if (fv === "all") return true;
      var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayOff) : null;
      // Baggage area includes BAG and DFO duty
      if (fv === "bag") return duty === "BAG" || duty === "DFO";
      // PAX = not on baggage-area duty
      if (fv === "pax") return duty !== "BAG" && duty !== "DFO";
      return true;
    }

    S.state.lines.forEach(function (line) {
      if (!roleOk(line)) return;
      if (!S.getShift(line.shiftId)) return;
      var isM = line.sex === "M";
      for (var dow = 0; dow < 7; dow++) {
        var off = dowToOffset[dow];
        if (off == null) continue;
        if ((S.state.schedule[line.id] || [])[off] !== "WORK") continue;
        if (!funcOk(line, off)) continue;
        var times = S.getEffectiveShiftTimes
          ? S.getEffectiveShiftTimes(line.shiftId, dow)
          : { start: S.getShift(line.shiftId).start, end: S.getShift(line.shiftId).end };
        var a = S.timeToMin(times.start);
        var b = S.timeToMin(times.end);
        slots.forEach(function (slot, si) {
          if (a < slot + 30 && b > slot) {
            if (isM) matrix[si][dow].m++;
            else matrix[si][dow].f++;
            matrix[si][dow].t++;
          }
        });
      }
    });
    return { slots: slots, matrix: matrix, dowToOffset: dowToOffset };
  };

  S.renderCoverageBars = function () {
    var head = S.$("coverage-matrix-head");
    var body = S.$("coverage-matrix-body");
    var bars = S.$("coverage-bars");
    var summary = S.$("coverage-summary");
    if (!head || !body) return;
    if (!S.state.lines.length) {
      head.innerHTML = "";
      body.innerHTML = '<tr><td class="muted">Generate or import a schedule to see 30-minute headcount by day.</td></tr>';
      if (bars) bars.innerHTML = "";
      if (summary) summary.textContent = "Generate or import to compute staffing by 30-minute slot and day.";
      return;
    }
    var computed = S.computeHourlyByDow();
    var slots = computed.slots;
    var matrix = computed.matrix;
    var allVals = [];
    matrix.forEach(function (row) {
      row.forEach(function (c) { allVals.push(c.t); });
    });
    var lo = Math.min.apply(null, allVals);
    var hi = Math.max.apply(null, allVals);
    var avg = allVals.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, allVals.length);

    var hr = "<tr><th>Time</th>";
    for (var d = 0; d < 7; d++) {
      hr += "<th>" + S.DAYS[d] + '<br><span class="muted" style="font-weight:400">M/F/T</span></th>';
    }
    hr += "<th>Avg T</th></tr>";
    head.innerHTML = hr;

    body.innerHTML = slots.map(function (slot, si) {
      var row = matrix[si];
      var rowAvg = row.reduce(function (a, c) { return a + c.t; }, 0) / 7;
      var cells = "<td>" + S.slotLabel(slot) + "</td>";
      for (var d = 0; d < 7; d++) {
        var c = row[d];
        var cls = "hc-ok";
        if (c.t === 0) cls = "hc-0";
        else if (c.t < avg * 0.75) cls = "hc-low";
        else if (c.t > avg * 1.25) cls = "hc-high";
        cells +=
          '<td class="' + cls + '" title="Male ' + c.m + " · Female " + c.f + " · Total " + c.t + '">' +
          '<span class="sex-m">' + c.m + "</span>/" +
          '<span class="sex-f">' + c.f + "</span>/" +
          c.t + "</td>";
      }
      cells += '<td class="muted">' + rowAvg.toFixed(1) + "</td>";
      return "<tr>" + cells + "</tr>";
    }).join("");

    var tot = "<tr><td><strong>Day total*</strong></td>";
    for (var d = 0; d < 7; d++) {
      var base = S.state.startDate ? S.state.startDate : S.parseStartDate(null);
      var off = null;
      for (var i = 0; i < Math.min(7, (S.state.weekCount || 1) * 7); i++) {
        if (base.add(i, "day").day() === d) { off = i; break; }
      }
      var m = 0, f = 0;
      if (off != null) {
        S.state.lines.forEach(function (line) {
          if (line.isLtso || line.isStso) return;
          if ((S.state.schedule[line.id] || [])[off] === "WORK") {
            if (line.sex === "M") m++;
            else f++;
          }
        });
      }
      tot +=
        "<td><strong><span class=\"sex-m\">" + m + "</span>/<span class=\"sex-f\">" + f + "</span>/" + (m + f) + "</strong></td>";
    }
    tot += "<td></td></tr>";
    body.innerHTML += tot;

    if (summary) {
      summary.innerHTML =
        '<span class="sex-legend">' +
        '<i class="sw-m"></i><span class="sex-m">Male</span> ' +
        '<i class="sw-f"></i><span class="sex-f">Female</span> ' +
        "· cells are TSO <strong>M/F/Total</strong></span> · " +
        "30-min TSO total " + lo + "–" + hi + " (avg " + avg.toFixed(1) + "). " +
        "*Day total = TSO on WORK that weekday.";
    }

    if (bars) {
      var slotSex = slots.map(function (slot, si) {
        var m = 0, f = 0;
        matrix[si].forEach(function (c) { m += c.m; f += c.f; });
        return { m: m / 7, f: f / 7, t: (m + f) / 7 };
      });
      var maxT = Math.max(1, Math.max.apply(null, slotSex.map(function (x) { return x.t; })));
      bars.innerHTML = slots.map(function (slot, si) {
        var x = slotSex[si];
        var pctM = maxT > 0 ? (100 * x.m) / maxT : 0;
        var pctF = maxT > 0 ? (100 * x.f) / maxT : 0;
        return (
          '<div class="cov-row"><span>' + S.slotLabel(slot) + "</span>" +
          '<div class="cov-track">' +
          '<div class="cov-fill-m" style="width:' + pctM.toFixed(2) + '%"></div>' +
          '<div class="cov-fill-f" style="width:' + pctF.toFixed(2) + '%"></div>' +
          "</div>" +
          '<span><span class="sex-m">' + x.m.toFixed(1) + "</span>/" +
          '<span class="sex-f">' + x.f.toFixed(1) + "</span>/" +
          x.t.toFixed(1) + "</span></div>"
        );
      }).join("");
    }
  };

  S.renderShiftSummary = function () {
    var tbody = S.$("shift-summary-body");
    if (!tbody) return;
    var counts = {};
    S.state.lines.forEach(function (l) {
      var k = l.shiftId + "|" + l.empClass + "|" + (l.sex || "?");
      counts[k] = (counts[k] || 0) + 1;
    });
    var rows = [];
    S.state.shifts.forEach(function (s) {
      var ftm = counts[s.id + "|FT|M"] || 0;
      var ftf = counts[s.id + "|FT|F"] || 0;
      var ptm = counts[s.id + "|PT|M"] || 0;
      var ptf = counts[s.id + "|PT|F"] || 0;
      var ltm = counts[s.id + "|LTSO|M"] || 0;
      var ltf = counts[s.id + "|LTSO|F"] || 0;
      var stm = counts[s.id + "|STSO|M"] || 0;
      var stf = counts[s.id + "|STSO|F"] || 0;
      var tsoTot = ftm + ftf + ptm + ptf;
      var supTot = ltm + ltf + stm + stf;
      var all = tsoTot + supTot;
      if (all === 0) return;
      var forceNote =
        (s.force > 0 ? " TSO×" + s.force : "") +
        (s.ltsoForce > 0 ? " LTSO×" + s.ltsoForce : "") +
        (s.stsoForce > 0 ? " STSO×" + s.stsoForce : "");
      rows.push(
        "<tr><td><span class=\"badge " + S.shiftBadge(s.id) + "\">" + s.name + "</span></td><td>" +
        s.start + "–" + s.end + "</td>" +
        '<td><span class="sex-m">' + ftm + '</span>/<span class="sex-f">' + ftf + "</span></td>" +
        '<td><span class="sex-m">' + ptm + '</span>/<span class="sex-f">' + ptf + "</span></td>" +
        '<td><span class="sex-m">' + ltm + '</span>/<span class="sex-f">' + ltf + "</span></td>" +
        '<td><span class="sex-m">' + stm + '</span>/<span class="sex-f">' + stf + "</span></td>" +
        "<td>" + tsoTot + "</td>" +
        "<td>" + all + (forceNote ? ' <span class="muted">(' + forceNote.trim() + ")</span>" : "") + "</td></tr>"
      );
    });
    tbody.innerHTML = rows.join("") || '<tr><td colspan="8" class="muted">No lines yet</td></tr>';
  };

  /** Lines view preferences (filter / group / sort) */
  S.linesView = S.linesView || {
    groupBy: "team",
    sortBy: "role",
    sortDir: "asc",
    filterRole: "ALL",
    filterShift: "",
    filterSex: "",
    filterTeam: ""
  };

  /** Resolve team for a line id */
  S.teamMetaForLine = function (lineId) {
    if (!S.teams || !S.teams.teams) return { order: 9999, name: "", id: "" };
    lineId = +lineId;
    for (var i = 0; i < S.teams.teams.length; i++) {
      var t = S.teams.teams[i];
      if (t.members && t.members.indexOf(lineId) !== -1) {
        return { order: i, name: t.name || t.id, id: t.id };
      }
    }
    return { order: 9999, name: "", id: "" };
  };

  S.teamNameForLine = function (lineId) {
    return S.teamMetaForLine(lineId).name;
  };

  /** Role rank: STSO → LTSO → TSO(FT) → PT */
  S.lineRoleRank = function (line) {
    if (line.isStso || line.empClass === "STSO") return 0;
    if (line.isLtso || line.empClass === "LTSO") return 1;
    if (line.empClass === "FT") return 2;
    if (line.empClass === "PT") return 3;
    return 4;
  };

  /** Recalculate rdoDays from schedule (first week DOW pattern) — RDO column is derived */
  S.syncRdoDaysFromSchedule = function (line) {
    if (!line) return;
    var sched = S.state.schedule[line.id] || [];
    var days = Math.min(7, (S.state.weekCount || 1) * 7);
    var base = S.state.startDate ? S.state.startDate : S.parseStartDate(null);
    var set = {};
    for (var d = 0; d < days; d++) {
      if (sched[d] === "RDO") {
        var dow = base.add(d, "day").day();
        set[dow] = true;
      }
    }
    line.rdoDays = Object.keys(set)
      .map(Number)
      .sort(function (a, b) { return a - b; });
  };

  S.rdoTextForLine = function (line) {
    var days = (line.rdoDays || []).map(function (i) { return (S.DAYS && S.DAYS[i]) || i; });
    var txt = days.length ? days.join(",") : "—";
    if (line.rdoHard) txt += " (hard)";
    return txt;
  };

  S.findLineById = function (id) {
    var want = String(id);
    for (var i = 0; i < S.state.lines.length; i++) {
      if (String(S.state.lines[i].id) === want) return S.state.lines[i];
    }
    return null;
  };

  S.setLineTeam = function (lineId, teamId) {
    lineId = +lineId;
    if (!S.teams || !S.teams.teams) return;
    S.teams.teams.forEach(function (t) {
      t.members = (t.members || []).filter(function (m) { return m !== lineId; });
    });
    if (teamId) {
      var team = null;
      for (var i = 0; i < S.teams.teams.length; i++) {
        if (S.teams.teams[i].id === teamId) { team = S.teams.teams[i]; break; }
      }
      if (team && team.members.indexOf(lineId) === -1) team.members.push(lineId);
    }
  };

  S.applyLineShift = function (line, shiftId) {
    var def = S.getShift(shiftId);
    if (!def || !line) return;
    line.shiftId = def.id;
    line.shiftName = def.name;
    line.shiftLabel = S.shiftLabel ? S.shiftLabel(def) : def.start + "-" + def.end;
    line.paid = def.paid || line.paid || 8;
  };

  S.applyLineEmp = function (line, emp) {
    if (!line) return;
    line.empClass = emp;
    line.isStso = emp === "STSO";
    line.isLtso = emp === "LTSO";
  };

  S.filterLinesForView = function (list) {
    var fr = S.linesView.filterRole || "ALL";
    var fs = S.linesView.filterShift || "";
    var fsex = S.linesView.filterSex || "";
    var ft = S.linesView.filterTeam || "";
    return list.filter(function (line) {
      if (fr === "STSO" && !(line.isStso || line.empClass === "STSO")) return false;
      if (fr === "LTSO" && !(line.isLtso || line.empClass === "LTSO")) return false;
      if (fr === "TSO" && (line.isStso || line.isLtso || line.empClass === "STSO" || line.empClass === "LTSO")) return false;
      if (fs && String(line.shiftId) !== String(fs)) return false;
      if (fsex && line.sex !== fsex) return false;
      if (ft === "__none__") {
        if (S.teamMetaForLine(line.id).id) return false;
      } else if (ft) {
        if (S.teamMetaForLine(line.id).id !== ft) return false;
      }
      return true;
    });
  };

  S.sortLinesForView = function (list) {
    var groupBy = S.linesView.groupBy || "none";
    var sortBy = S.linesView.sortBy || "role";
    var dir = S.linesView.sortDir === "desc" ? -1 : 1;

    function groupKey(line) {
      if (groupBy === "team") {
        var tm = S.teamMetaForLine(line.id);
        return tm.id ? "T:" + tm.order + ":" + tm.name : "Z:unassigned";
      }
      if (groupBy === "shift") return "S:" + (line.shiftId || "");
      if (groupBy === "role") return "R:" + S.lineRoleRank(line);
      if (groupBy === "start") {
        var sh = S.getShift(line.shiftId);
        return "A:" + String(sh ? S.timeToMin(sh.start) : 0).padStart(4, "0");
      }
      return "";
    }

    function cmpVal(line) {
      if (sortBy === "team") {
        var tm = S.teamMetaForLine(line.id);
        return tm.order;
      }
      if (sortBy === "role") return S.lineRoleRank(line);
      if (sortBy === "shift") {
        var sh = S.getShift(line.shiftId);
        return sh ? S.timeToMin(sh.start) : 0;
      }
      if (sortBy === "line") return (line.lineCode || "").toLowerCase();
      if (sortBy === "sex") return line.sex === "M" ? 0 : 1;
      return line.id;
    }

    return list.slice().sort(function (a, b) {
      var ga = groupKey(a);
      var gb = groupKey(b);
      if (ga < gb) return -1;
      if (ga > gb) return 1;
      var va = cmpVal(a);
      var vb = cmpVal(b);
      if (typeof va === "string") {
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
      } else {
        if (va !== vb) return (va - vb) * dir;
      }
      return (a.id - b.id) * dir;
    });
  };

  S.renderLines = function () {
    var thead = S.$("lines-thead");
    var tbody = S.$("lines-tbody");
    if (!thead || !tbody) return;

    // Sync toolbar selects
    var gEl = S.$("lines-group-by");
    var sEl = S.$("lines-sort-by");
    var dEl = S.$("lines-sort-dir");
    var frEl = S.$("lines-filter-role");
    var fsEl = S.$("lines-filter-shift");
    var fsexEl = S.$("lines-filter-sex");
    var ftEl = S.$("lines-filter-team");
    if (gEl) gEl.value = S.linesView.groupBy || "team";
    if (sEl) sEl.value = S.linesView.sortBy || "role";
    if (dEl) dEl.value = S.linesView.sortDir || "asc";
    if (frEl) frEl.value = S.linesView.filterRole || "ALL";
    if (fsexEl) fsexEl.value = S.linesView.filterSex || "";

    // Populate shift filter options
    if (fsEl) {
      var shiftHtml = '<option value="">All shifts</option>';
      (S.state.shifts || []).forEach(function (sh) {
        shiftHtml +=
          '<option value="' + sh.id + '"' +
          (String(S.linesView.filterShift) === String(sh.id) ? " selected" : "") +
          ">" +
          String(sh.name || sh.id).replace(/</g, "&lt;") +
          "</option>";
      });
      fsEl.innerHTML = shiftHtml;
    }
    // Populate team filter options
    if (ftEl) {
      var teamHtml =
        '<option value="">All</option>' +
        '<option value="__none__"' +
        (S.linesView.filterTeam === "__none__" ? " selected" : "") +
        ">Unassigned</option>";
      if (S.teams && S.teams.teams) {
        S.teams.teams.forEach(function (t) {
          teamHtml +=
            '<option value="' + t.id + '"' +
            (S.linesView.filterTeam === t.id ? " selected" : "") +
            ">" +
            String(t.name || t.id).replace(/</g, "&lt;") +
            "</option>";
        });
      }
      ftEl.innerHTML = teamHtml;
    }

    var days = (S.state.weekCount || 1) * 7;
    var hr = "<tr><th>Team</th><th>Line</th><th>Shift</th><th>Emp</th><th>Sex</th><th>Function</th><th>RDOs</th>";
    for (var d = 0; d < days; d++) {
      hr += "<th>" + S.dayLabel(d).replace(" ", "<br>") + "</th>";
    }
    hr += "<th>Hours</th></tr>";
    thead.innerHTML = hr;

    if (!S.state.lines.length) {
      tbody.innerHTML = '<tr><td colspan="20" class="muted">Generate or import to build lines</td></tr>';
      return;
    }

    var sortedLines = S.sortLinesForView(S.filterLinesForView(S.state.lines));

    function teamSelectHtml(selectedId) {
      var opts = '<option value=""' + (!selectedId ? " selected" : "") + ">—</option>";
      if (S.teams && S.teams.teams) {
        S.teams.teams.forEach(function (t) {
          opts +=
            '<option value="' + t.id + '"' +
            (t.id === selectedId ? " selected" : "") +
            ">" +
            String(t.name || t.id).replace(/</g, "&lt;") +
            "</option>";
        });
      }
      return opts;
    }
    function shiftSelectHtml(selectedId) {
      return (S.state.shifts || [])
        .map(function (sh) {
          return (
            '<option value="' + sh.id + '"' +
            (sh.id === selectedId ? " selected" : "") +
            ">" +
            String(sh.name || sh.id).replace(/</g, "&lt;") +
            " (" + sh.start + "–" + sh.end + ")</option>"
          );
        })
        .join("");
    }
    function empSelectHtml(selected) {
      return ["FT", "PT", "LTSO", "STSO"]
        .map(function (e) {
          return (
            '<option value="' + e + '"' +
            (e === selected ? " selected" : "") +
            ">" + e + "</option>"
          );
        })
        .join("");
    }

    var html = "";
    var lastGroup = null;
    var groupBy = S.linesView.groupBy || "none";

    sortedLines.forEach(function (line) {
      // Group header rows
      if (groupBy !== "none") {
        var gLabel = "";
        if (groupBy === "team") {
          var tm = S.teamMetaForLine(line.id);
          gLabel = tm.name ? "Team: " + tm.name : "Unassigned";
        } else if (groupBy === "shift") {
          var def = S.getShift(line.shiftId);
          gLabel = "Shift: " + (line.shiftName || (def && def.name) || line.shiftId);
        } else if (groupBy === "role") {
          var r = S.lineRoleRank(line);
          gLabel = "Role: " + (r === 0 ? "STSO" : r === 1 ? "LTSO" : r === 2 ? "FT (TSO)" : r === 3 ? "PT (TSO)" : "Other");
        } else if (groupBy === "start") {
          var sh2 = S.getShift(line.shiftId);
          gLabel = "Start: " + (sh2 ? sh2.start : "—");
        }
        if (gLabel !== lastGroup) {
          lastGroup = gLabel;
          html +=
            '<tr class="lines-group-row"><td colspan="20"><strong>' +
            gLabel +
            "</strong></td></tr>";
        }
      }

      var hours = 0;
      var cells = "";
      for (var di = 0; di < days; di++) {
        var v = (S.state.schedule[line.id] && S.state.schedule[line.id][di]) || "RDO";
        if (v === "WORK") {
          hours += line.paid || 0;
          var duty = S.getRotationDuty ? S.getRotationDuty(line.id, di) : null;
          var dutyCls = duty ? " cell-function-duty" : "";
          var dutyTip = duty ? " · " + duty + " duty" : "";
          cells +=
            '<td class="cell-work cell-toggle' +
            dutyCls +
            '" data-line-id="' +
            line.id +
            '" data-day="' +
            di +
            '" title="Click to toggle RDO' +
            dutyTip +
            '">' +
            (line.shiftLabel || "WORK") +
            "</td>";
        } else {
          cells +=
            '<td class="cell-rdo cell-toggle" data-line-id="' +
            line.id +
            '" data-day="' +
            di +
            '" title="Click to toggle WORK">RDO</td>';
        }
      }

      var rdoTxt = S.rdoTextForLine(line);
      var empVal = line.isStso ? "STSO" : line.isLtso ? "LTSO" : line.empClass || "FT";
      var teamMeta = S.teamMetaForLine(line.id);

      html +=
        '<tr data-line-row="' + line.id + '">' +
        '<td><select class="line-edit" data-field="team" data-line-id="' + line.id + '">' +
        teamSelectHtml(teamMeta.id) +
        "</select></td>" +
        '<td><input type="text" class="line-edit line-code-input" data-field="lineCode" data-line-id="' +
        line.id +
        '" value="' +
        String(line.lineCode || "").replace(/"/g, "&quot;") +
        '"></td>' +
        '<td><select class="line-edit" data-field="shift" data-line-id="' + line.id + '">' +
        shiftSelectHtml(line.shiftId) +
        "</select></td>" +
        '<td><select class="line-edit" data-field="emp" data-line-id="' + line.id + '">' +
        empSelectHtml(empVal) +
        "</select></td>" +
        '<td><select class="line-edit" data-field="sex" data-line-id="' + line.id + '">' +
        '<option value="M"' + (line.sex === "M" ? " selected" : "") + ">M</option>" +
        '<option value="F"' + (line.sex === "F" ? " selected" : "") + ">F</option>" +
        "</select></td>" +
        '<td><select class="line-edit" data-field="function" data-line-id="' + line.id + '">' +
        '<option value=""' + (!line.function ? " selected" : "") + ">—</option>" +
        '<option value="DFO"' + (line.function === "DFO" ? " selected" : "") + ">DFO</option>" +
        '<option value="PAX"' + (line.function === "PAX" ? " selected" : "") + ">PAX</option>" +
        '<option value="BAG"' + (line.function === "BAG" ? " selected" : "") + ">BAG</option>" +
        "</select></td>" +
        '<td class="muted line-rdo-cell" data-line-id="' + line.id + '">' + rdoTxt + "</td>" +
        cells +
        '<td class="line-hours" data-line-id="' + line.id + '">' + hours + "</td>" +
        "</tr>";
    });

    tbody.innerHTML = html;
  };

  S.refreshLineRowDerived = function (lineId) {
    var line = S.findLineById(lineId);
    if (!line) return;
    // Update RDO text + hours without full re-render if possible
    var rdoCell = document.querySelector('.line-rdo-cell[data-line-id="' + lineId + '"]');
    if (rdoCell) rdoCell.textContent = S.rdoTextForLine(line);
    var hoursCell = document.querySelector('.line-hours[data-line-id="' + lineId + '"]');
    if (hoursCell) {
      var days = (S.state.weekCount || 1) * 7;
      var h = 0;
      for (var d = 0; d < days; d++) {
        if ((S.state.schedule[line.id] || [])[d] === "WORK") h += line.paid || 0;
      }
      hoursCell.textContent = h;
    }
  };

  S.bindLinesUI = function () {
    if (S._linesUIBound) return;
    S._linesUIBound = true;

    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === "lines-group-by") {
        S.linesView.groupBy = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-sort-by") {
        S.linesView.sortBy = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-sort-dir") {
        S.linesView.sortDir = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-filter-role") {
        S.linesView.filterRole = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-filter-shift") {
        S.linesView.filterShift = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-filter-sex") {
        S.linesView.filterSex = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "lines-filter-team") {
        S.linesView.filterTeam = t.value;
        S.renderLines();
        return;
      }
      if (t.id === "cov-role-stso" || t.id === "cov-role-ltso" || t.id === "cov-role-tso") {
        if (!S.coverageView) S.coverageView = { stso: false, ltso: false, tso: true, funcView: "all" };
        S.coverageView.stso = !!(S.$("cov-role-stso") && S.$("cov-role-stso").checked);
        S.coverageView.ltso = !!(S.$("cov-role-ltso") && S.$("cov-role-ltso").checked);
        S.coverageView.tso = !!(S.$("cov-role-tso") && S.$("cov-role-tso").checked);
        S.renderCoverageBars();
        return;
      }
      if (t.name === "cov-func-view") {
        if (!S.coverageView) S.coverageView = { stso: false, ltso: false, tso: true, funcView: "all" };
        S.coverageView.funcView = t.value || "all";
        S.renderCoverageBars();
        return;
      }
      if (!t.classList.contains("line-edit")) return;
      var lineId = t.getAttribute("data-line-id");
      var field = t.getAttribute("data-field");
      var line = S.findLineById(lineId);
      if (!line) return;

      if (field === "lineCode") {
        line.lineCode = t.value.trim() || line.lineCode;
      } else if (field === "sex") {
        line.sex = t.value === "F" ? "F" : "M";
      } else if (field === "function") {
        var fv = t.value;
        line.function = fv === "DFO" || fv === "PAX" || fv === "BAG" ? fv : "";
      } else if (field === "emp") {
        S.applyLineEmp(line, t.value);
        S.renderLines();
        if (S.renderCoverageBars) S.renderCoverageBars();
        if (S.renderTeams) S.renderTeams();
        return;
      } else if (field === "shift") {
        S.applyLineShift(line, t.value);
        S.renderLines();
        if (S.renderCoverageBars) S.renderCoverageBars();
        return;
      } else if (field === "team") {
        S.setLineTeam(lineId, t.value);
        S.renderLines();
        if (S.renderTeams) S.renderTeams();
        return;
      }
      if (S.updateStatus) S.updateStatus("Updated " + (line.lineCode || lineId));
    });

    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === "btn-lines-clear-filters") {
        S.linesView.filterRole = "ALL";
        S.linesView.filterShift = "";
        S.linesView.filterSex = "";
        S.linesView.filterTeam = "";
        S.renderLines();
        return;
      }
      // Day cell toggle — use closest so nested text still works
      var cell = t.classList && t.classList.contains("cell-toggle")
        ? t
        : (t.closest ? t.closest(".cell-toggle") : null);
      if (!cell) return;
      var lineId = cell.getAttribute("data-line-id");
      var day = +cell.getAttribute("data-day");
      var line = S.findLineById(lineId);
      if (!line || isNaN(day)) return;
      var key = line.id; // use actual line id key
      if (!S.state.schedule[key]) S.state.schedule[key] = [];
      var cur = S.state.schedule[key][day] || "RDO";
      var next = cur === "WORK" ? "RDO" : "WORK";
      S.state.schedule[key][day] = next;
      S.syncRdoDaysFromSchedule(line);
      if (next === "WORK") {
        cell.className = "cell-work cell-toggle";
        cell.textContent = line.shiftLabel || "WORK";
        cell.title = "Click to toggle RDO";
      } else {
        cell.className = "cell-rdo cell-toggle";
        cell.textContent = "RDO";
        cell.title = "Click to toggle WORK";
      }
      S.refreshLineRowDerived(line.id);
      if (S.renderCoverageBars) S.renderCoverageBars();
      if (S.updateStatus) {
        S.updateStatus(
          (line.lineCode || lineId) + " day " + (day + 1) + " → " + next +
          " · RDO " + S.rdoTextForLine(line)
        );
      }
    });
  };

  S.renderIssues = function () {
    var el = S.$("issues");
    if (!el) return;
    if (!S.state.issues.length) {
      el.innerHTML = '<div class="alert alert-ok">Ready — v2 TSO + LTSO/STSO management. Import/export enabled.</div>';
      return;
    }
    el.innerHTML = S.state.issues
      .map(function (m) { return '<div class="alert alert-warn">' + m + "</div>"; })
      .join("");
  };

  S.renderAll = function () {
    S.renderCoverageBars();
    S.renderShiftSummary();
    S.renderLines();
    S.renderIssues();
  };

  S.switchTab = function (name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
    // Refresh teams UI when opening the tab (picks up newly generated lines)
    if (name === "teams" && S.renderTeams) S.renderTeams();
    if (name === "lines" && S.renderLines) S.renderLines();
    if (name === "coverage" && S.renderCoverageBars) S.renderCoverageBars();
    if (name === "reports" && S.renderReports) S.renderReports();
  };
})(window.Scheduler);

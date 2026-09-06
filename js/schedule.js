/** Schedule generation — classic script (dayjs) */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.buildScheduleForLine = function (line, days) {
    var arr = [];
    var rdo = new Set((line.rdoDays || []).map(Number));
    var need = S.targetWorkDays(line.shiftId, line.empClass);
    var base = S.state.startDate ? S.state.startDate : S.parseStartDate(null);
    var weeks = Math.ceil(days / 7);
    for (var w = 0; w < weeks; w++) {
      var weekOffsets = [];
      for (var i = 0; i < 7; i++) {
        var off = w * 7 + i;
        if (off >= days) break;
        var dt = base.add(off, "day");
        weekOffsets.push({ off: off, dow: dt.day() });
      }
      var weekVal = {};
      weekOffsets.forEach(function (x) {
        weekVal[x.off] = rdo.has(x.dow) ? "RDO" : "WORK";
      });
      var workOffs = weekOffsets
        .filter(function (x) { return weekVal[x.off] === "WORK"; })
        .sort(function (a, b) { return a.dow - b.dow; });
      workOffs.forEach(function (x, idx) {
        weekVal[x.off] = idx < need ? "WORK" : "RDO";
      });
      weekOffsets.forEach(function (x) { arr[x.off] = weekVal[x.off]; });
    }
    for (var i = 0; i < days; i++) if (!arr[i]) arr[i] = "RDO";
    return arr.slice(0, days);
  };

  S.generate = function () {
    S.state.issues = [];
    S.state.open = (S.$("cfg-open") && S.$("cfg-open").value) || "03:30";
    S.state.close = (S.$("cfg-close") && S.$("cfg-close").value) || "23:00";
    S.state.weekCount = Math.max(1, Math.min(8, +(S.$("cfg-weeks") && S.$("cfg-weeks").value) || 1));
    S.state.ftM = Math.max(0, +(S.$("cfg-ft-m") && S.$("cfg-ft-m").value) || 0);
    S.state.ftF = Math.max(0, +(S.$("cfg-ft-f") && S.$("cfg-ft-f").value) || 0);
    S.state.ptM = Math.max(0, +(S.$("cfg-pt-m") && S.$("cfg-pt-m").value) || 0);
    S.state.ptF = Math.max(0, +(S.$("cfg-pt-f") && S.$("cfg-pt-f").value) || 0);
    S.state.ltsoM = Math.max(0, +(S.$("cfg-ltso-m") && S.$("cfg-ltso-m").value) || 0);
    S.state.ltsoF = Math.max(0, +(S.$("cfg-ltso-f") && S.$("cfg-ltso-f").value) || 0);
    S.state.stsoM = Math.max(0, +(S.$("cfg-stso-m") && S.$("cfg-stso-m").value) || 0);
    S.state.stsoF = Math.max(0, +(S.$("cfg-stso-f") && S.$("cfg-stso-f").value) || 0);

    var startVal = S.$("cfg-start") && S.$("cfg-start").value;
    S.state.startDate = S.parseStartDate(startVal || null);
    S.readShiftsFromDom();

    if (!S.state.shifts.length) {
      S.state.issues.push("Add at least one shift with a start and end time.");
      S.renderAll();
      S.updateStatus("No shifts defined.");
      return;
    }
    S.state.shifts.forEach(function (s) {
      if (!s.rdoHard || !s.rdoHard.length) return;
      var need = S.rdoCountForShift(s, "FT");
      if (s.rdoHard.length !== need) {
        S.state.issues.push(s.name + ": hard RDOs checked " + s.rdoHard.length + " day(s); pattern expects " + need + " (paid " + s.paid + "h). Days kept; work-day count may adjust.");
      }
    });

    var total = S.state.ftM + S.state.ftF + S.state.ptM + S.state.ptF;
    if (total <= 0) {
      S.state.issues.push("Set FT/PT male and female headcounts above zero.");
      S.state.lines = [];
      S.state.schedule = {};
      S.renderAll();
      S.updateStatus("No staff to schedule.");
      return;
    }
    var openMin = S.timeToMin(S.state.open);
    var closeMin = S.timeToMin(S.state.close);
    if (closeMin <= openMin) {
      S.state.issues.push("Close time must be after open time.");
      S.renderAll();
      return;
    }

    var allocation = S.allocateShiftHeadcounts(total, openMin, closeMin);
    var counts = allocation.counts;
    var mode = allocation.mode;
    S.state.mode = mode;
    var tsoLines = S.buildLines(counts);

    var ltsoTotal = S.state.ltsoM + S.state.ltsoF;
    var ltsoLines = [];
    if (ltsoTotal > 0) {
      var ltsoAlloc = S.allocateSupervisoryHeadcounts(ltsoTotal, openMin, closeMin, "ltsoForce", tsoLines);
      ltsoLines = S.buildSupervisoryLines(ltsoAlloc.counts || {}, "LTSO");
    }
    var stsoTotal = S.state.stsoM + S.state.stsoF;
    var stsoLines = [];
    if (stsoTotal > 0) {
      var stsoAlloc = S.allocateSupervisoryHeadcounts(stsoTotal, openMin, closeMin, "stsoForce", tsoLines);
      stsoLines = S.buildSupervisoryLines(stsoAlloc.counts || {}, "STSO");
    }
    S.state.lines = [].concat(tsoLines, ltsoLines, stsoLines);

    var days = S.state.weekCount * 7;
    S.state.schedule = {};
    S.state.lines.forEach(function (line) {
      S.state.schedule[line.id] = S.buildScheduleForLine(line, days);
    });

    var dayTotals = [];
    var workingLines = S.state.lines.filter(function (l) { return !l.isLtso && !l.isStso; });
    for (var d = 0; d < Math.min(7, days); d++) {
      dayTotals.push(workingLines.filter(function (l) {
        return S.state.schedule[l.id][d] === "WORK";
      }).length);
    }
    var dMin = Math.min.apply(null, dayTotals);
    var dMax = Math.max.apply(null, dayTotals);
    if (dMax - dMin > Math.max(2, Math.ceil(total * 0.15))) {
      S.state.issues.push("Day-of-week TSO headcount still varies " + dMin + "–" + dMax + " (RDO stagger). Prefer varied seeds are already applied.");
    }
    S.renderAll();
    S.updateStatus(
      "Scheduled " + S.state.lines.length + " lines (FT " + S.state.ftM + "/" + S.state.ftF +
      " · PT " + S.state.ptM + "/" + S.state.ptF +
      " · LTSO " + S.state.ltsoM + "/" + S.state.ltsoF +
      " · STSO " + S.state.stsoM + "/" + S.state.stsoF +
      ") · " + mode + " · " + S.state.weekCount + " wk" +
      (S.state.issues.length ? " · " + S.state.issues.length + " note(s)" : "")
    );
  };
})(window.Scheduler);

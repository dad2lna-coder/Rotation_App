(function () {
  var Sch = window.Scheduler;

  function $(id) { return document.getElementById(id); }

  function isoFromStart(dayIndex) {
    var el = $("cfg-start") || $("iDate");
    var raw = el && el.value;
    var d = raw ? new Date(raw + "T00:00:00") : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + dayIndex);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function ensureFuncUi() {
    var row = document.querySelector(".fc-pool-row");
    if (row && !$("fc-pool-bag")) {
      var lab = document.createElement("label");
      lab.innerHTML = 'BAG TSO <input type="number" id="fc-pool-bag" min="0" value="2" style="width:4rem" />';
      row.appendChild(lab);
    }
    if (row && !$("fc-generate")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-amber";
      btn.id = "fc-generate";
      btn.textContent = "Assign DFO / BAG days";
      row.appendChild(btn);
      if (Sch && Sch.generateFunctionAssignments) {
        btn.addEventListener("click", function () {
          Sch.generateFunctionAssignments();
          pushLinesToRotation();
        });
      }
    }
    var st = $("fc-pool-stso"); if (st && +st.value === 0) st.value = "1";
    var lt = $("fc-pool-ltso"); if (lt && +lt.value === 0) lt.value = "1";
    var ts = $("fc-pool-tso"); if (ts && +ts.value === 0) ts.value = "4";
    var bg = $("fc-pool-bag"); if (bg && +bg.value === 0) bg.value = "2";
  }

  function pushLinesToRotation() {
    if (!Sch || !Sch.state || !Sch.state.lines || !Sch.state.lines.length) return;
    var RS = window.S;
    var locEl = $("iLoc");
    var loc = (locEl && locEl.value) || "CKPT-A12";
    var rows = [];
    var dates = {};
    Sch.state.lines.forEach(function (line) {
      var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
      var duties = (Sch.state.functionRotation || {})[String(line.id)] || [];
      var sh = Sch.getShift ? Sch.getShift(line.shiftId) : null;
      var start = sh && Sch.timeToMin ? Sch.timeToMin(sh.start) : 240;
      var end = sh && Sch.timeToMin ? Sch.timeToMin(sh.end) : start + Math.round((line.paid || 8) * 60);
      if (end <= start) end += 1440;
      var role = Sch.lineRoleKey ? Sch.lineRoleKey(line) : (line.empClass || "TSO");
      var shiftName = start < 12 * 60 ? "AM" : "PM";
      sched.forEach(function (cell, di) {
        if (cell !== "WORK") return;
        var duty = duties[di] || line.function || "";
        var title = role;
        if (duty === "DFO") title = role + "/DFO";
        if (duty === "BAG") title = role + "/BAG";
        var date = isoFromStart(di);
        dates[date] = true;
        rows.push({
          k: "L" + line.id + "-" + di,
          n: line.lineCode || ("Line " + String(line.id).padStart(3, "0")),
          ti: title,
          po: duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : "TDC",
          lo: loc,
          d: date,
          sh: shiftName,
          s: start,
          e: end,
          x: line.sex || "M",
          q: "1234Z",
          ab: [],
          tr: [],
          nt: duty ? [duty] : []
        });
      });
    });
    if (!rows.length) return;
    if (typeof RS === "object") {
      RS.roster = rows;
      RS.meta = {
        file: "(from Blade lines)",
        rows: rows.length,
        when: "blade-generate",
        dates: Object.keys(dates).sort(),
        unknown: {},
        locs: {}
      };
      RS.meta.locs[loc] = rows.length;
      if (typeof DB !== "undefined" && DB.set) {
        DB.set("roster", RS.roster);
        DB.set("rosterMeta", RS.meta);
      }
    }
    if ($("rosterInfo")) {
      $("rosterInfo").innerHTML = "<b>" + rows.length + "</b> rows from Blade lines" +
        "<br>" + Object.keys(dates).sort().join(", ");
    }
    var first = Object.keys(dates).sort()[0];
    if ($("iDate") && first) $("iDate").value = first;
    if ($("iLoc")) {
      if (typeof fillLocSelect === "function") fillLocSelect();
      $("iLoc").value = loc;
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if (Sch.updateStatus) {
      Sch.updateStatus("Lines → Rotation: " + rows.length + " checkpoint rows. Open [F7] and Generate Rotation.");
    }
  }

  function wrapGenerate() {
    if (!Sch || typeof Sch.generate !== "function" || Sch.generate._bridged) return;
    var orig = Sch.generate;
    Sch.generate = function () {
      orig.apply(this, arguments);
      try {
        ensureFuncUi();
        if (typeof Sch.readFunctionBandsFromDom === "function") Sch.readFunctionBandsFromDom();
        if (typeof Sch.generateFunctionAssignments === "function") Sch.generateFunctionAssignments();
      } catch (e) { console.warn("function assign", e); }
      try { pushLinesToRotation(); } catch (e) { console.warn("push rotation", e); }
    };
    Sch.generate._bridged = true;
  }

  function boot() {
    ensureFuncUi();
    wrapGenerate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.pushLinesToRotation = pushLinesToRotation;
})();

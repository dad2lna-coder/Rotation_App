/* Map a BLADE_Alpha export JSON (or live Scheduler.state) onto Rotation roster rows.
   Classic script — same style as BLADE js/*.js
*/
window.Rotation = window.Rotation || {};
(function (R) {
  "use strict";

  function pad2(n) { return String(n).padStart(2, "0"); }

  function datePlus(startISO, dayIndex) {
    if (window.dayjs) return window.dayjs(startISO).add(dayIndex, "day").format("YYYY-MM-DD");
    var d = new Date(startISO + "T00:00:00");
    d.setDate(d.getDate() + dayIndex);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function titleOf(line) {
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return line.empClass === "PT" ? "PTSO" : "TSO";
  }

  function shiftTimes(line, shifts) {
    var start = "", end = "";
    var list = shifts || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(line.shiftId)) {
        start = list[i].start || "";
        end = list[i].end || "";
      }
    }
    return { start: start, end: end };
  }

  function ampm(start) {
    var m = String(start || "").match(/^(\d{1,2}):/);
    if (!m) return "AM";
    return +m[1] >= 12 ? "PM" : "AM";
  }

  R.rosterFromBlade = function (payload, opts) {
    opts = opts || {};
    var cfg = payload.config || payload;
    var results = payload.results || payload;
    var lines = results.lines || payload.lines || [];
    var schedule = results.schedule || payload.schedule || {};
    var shifts = (cfg && cfg.shifts) || [];
    var start = opts.startDate || cfg.startDate;
    if (!start) throw new Error("BLADE payload needs config.startDate");
    var weeks = opts.weekCount || cfg.weekCount || 1;
    var loc = opts.location || "CKPT-A12";
    var rows = [];
    lines.forEach(function (line) {
      var times = shiftTimes(line, shifts);
      var sh = ampm(times.start);
      var days = weeks * 7;
      for (var d = 0; d < days; d++) {
        var dow = d % 7;
        var sched = (schedule[line.id] || schedule[String(line.id)] || [])[dow] || "";
        var rdo = Array.isArray(line.rdoDays) && line.rdoDays.indexOf(dow) >= 0;
        if (sched === "RDO" || rdo) continue;
        if (sched && sched !== "WORK") continue;
        rows.push({
          k: String(line.id),
          n: line.lineCode || ("Line " + line.id),
          ti: titleOf(line),
          po: line.function || titleOf(line),
          lo: loc,
          d: datePlus(start, d),
          sh: sh,
          s: window.t2m ? t2m(times.start) : times.start,
          e: window.t2m ? t2m(times.end) : times.end,
          x: String(line.sex || "").toUpperCase().charAt(0),
          q: "",
          ab: [],
          tr: [],
          nt: line.function ? ["FN " + line.function] : []
        });
      }
    });
    return rows;
  };

  R.loadBladeJson = function (obj, opts) {
    var rows = R.rosterFromBlade(obj, opts);
    if (window.S) {
      window.S.roster = rows;
      window.S.meta = window.S.meta || {};
      window.S.meta.file = "blade-export.json";
      window.S.meta.rows = rows.length;
      window.S.meta.when = new Date().toISOString();
    }
    return rows;
  };
})(window.Rotation);

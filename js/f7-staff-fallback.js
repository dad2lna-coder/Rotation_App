/** If F7 location/date/shift finds nobody, build the sheet from BLADE line values. */
(function () {
  "use strict";

  function locMatch(rowLoc, want) {
    if (!want) return true;
    if (!rowLoc) return true;
    var a = String(rowLoc).toUpperCase().replace(/\s+/g, " ");
    var b = String(want).toUpperCase().replace(/\s+/g, " ");
    if (a === b) return true;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
    var tail = function (s) {
      var p = s.split(/[\/\-]/);
      return p[p.length - 1].trim();
    };
    return tail(a) && tail(a) === tail(b);
  }

  function lineName(r) {
    return r.n || r.lineCode || r.k || ("L" + (r.id || ""));
  }

  function personFromRow(r, w0, w1, slot) {
    var s = r.s != null ? r.s : w0;
    var e = r.e != null ? r.e : w1;
    if (e <= s) e += 1440;
    var s0 = Math.max(s, w0), e0 = Math.min(e, w1);
    if (e0 - s0 < slot) { s0 = w0; e0 = w1; }
    return {
      k: r.k || lineName(r),
      n: lineName(r),
      ti: r.ti || "TSO",
      po: r.po || "TDC",
      sex: r.x || r.sex || "M",
      quals: r.q || r.quals || "1234Z",
      s: s0, e: e0, rawS: s, rawE: e,
      abs: [], trn: [],
      notes: (r.nt && r.nt.slice) ? r.nt.slice() : ["line " + lineName(r)],
      restrict: null, pinned: false, mod: null, seat: null,
      preferMod: null,
      shift: r.sh || "",
      fromLine: true
    };
  }

  function ensureLocation(cfg, locId, rows) {
    if (!cfg || !cfg.locations) return;
    if (cfg.locations[locId]) return;
    var open = "03:30", close = "23:00";
    var lanes = [1, 2];
    if (rows && rows.length) {
      var mins = rows.map(function (r) { return r.s; }).filter(function (n) { return n != null; });
      var maxs = rows.map(function (r) { return r.e; }).filter(function (n) { return n != null; });
      if (mins.length) open = (window.m2t ? m2t(Math.min.apply(null, mins)) : open);
      if (maxs.length) {
        var mx = Math.max.apply(null, maxs);
        if (mx > 1440) mx = mx % 1440;
        close = window.m2t ? m2t(mx) : close;
      }
      if (rows[0].lanes && rows[0].lanes.length) lanes = rows[0].lanes;
    }
    var term = (String(locId).split("/")[0] || "A").replace(/TERMINAL/i, "").trim() || "A";
    var lane = function (n) { return { n: n, ct: 0 }; };
    cfg.locations[locId] = {
      t: term.charAt(0),
      open: open,
      close: close,
      mods: [lanes.map(lane)],
      kcm: null,
      exit: { am: 0, pm: 0 }
    };
  }

  function wrapStaffFor() {
    if (typeof staffFor !== "function" || staffFor._f7) return;
    var orig = staffFor;
    window.staffFor = function (roster, loc, date, w0, w1, cfg, adj, shift) {
      var out = [];
      try { out = orig.apply(this, arguments) || []; } catch (e) { out = []; }
      if (out.length) {
        out.forEach(function (p) { if (!p.n) p.n = p.k; });
        return out;
      }
      var slot = (cfg && cfg.rules && cfg.rules.slot) || 30;
      var want = String(shift || "").toUpperCase();
      (roster || []).forEach(function (r) {
        if (date && r.d && r.d !== date) return;
        if (want && r.sh && r.sh !== want && r.sh !== "") {
          /* still keep Gen-2 line-days; shift label is AM/PM from start time */
          if (r.generation !== 2 && !r.needsPlacement) return;
        }
        if (loc && r.lo && !locMatch(r.lo, loc)) return;
        out.push(personFromRow(r, w0, w1, slot));
      });
      if (out.length) return out;
      (roster || []).forEach(function (r) {
        if (want && r.sh && r.sh !== want) return;
        out.push(personFromRow(r, w0, w1, slot));
      });
      return out;
    };
    staffFor._f7 = true;
  }

  function wrapGenerate() {
    if (typeof generate !== "function" || generate._f7lines) return;
    var orig = generate;
    window.generate = function (newSeed) {
      var RS = window.S;
      if (RS && RS.cfg && RS.cfg.titles) {
        RS.cfg.titles.STSO = 1;
        RS.cfg.titles["STSO/DFO"] = 1;
        RS.cfg.titles["LTSO/DFO"] = 1;
        RS.cfg.titles["TSO/DFO"] = 1;
        RS.cfg.titles["TSO/BAG"] = 1;
        RS.cfg.titles["LTSO/BAG"] = 1;
        RS.cfg.titles["STSO/BAG"] = 1;
      }
      if (RS && RS.roster && RS.roster.length && RS.cfg) {
        var seen = {};
        RS.roster.forEach(function (r) {
          if (!r.lo) return;
          if (seen[r.lo]) return;
          seen[r.lo] = 1;
          ensureLocation(RS.cfg, r.lo, RS.roster.filter(function (x) { return x.lo === r.lo; }));
        });
        if (typeof fillLocSelect === "function") fillLocSelect();
        var locEl = document.getElementById("iLoc");
        if (locEl && !locEl.value) {
          var first = Object.keys(seen)[0];
          if (first) {
            locEl.value = first;
            locEl.dispatchEvent(new Event("change"));
          }
        }
      }
      return orig.apply(this, arguments);
    };
    generate._f7lines = true;
  }

  function boot() {
    wrapStaffFor();
    wrapGenerate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

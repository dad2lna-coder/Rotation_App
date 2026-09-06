(function () {
  "use strict";
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function $(id) { return document.getElementById(id); }

  function bladeLine(id) {
    var Sch = window.Scheduler;
    var lines = Sch && Sch.state && Sch.state.lines || [];
    var raw = String(id == null ? "" : id).replace(/^L/i, "");
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].id) === raw || String(lines[i].id) === String(id)) return lines[i];
      if (lines[i].lineCode && lines[i].lineCode === id) return lines[i];
    }
    return null;
  }

  function lineName(r) {
    var live = bladeLine(r && (r.k || r.id));
    if (live && live.lineCode) return live.lineCode;
    if (r && r.n && !/^L\d+$/i.test(r.n) && r.n.indexOf("Officer") === -1) return r.n;
    if (r && r.lineCode) return r.lineCode;
    return (r && r.n) || (r && r.k) || "Line";
  }

  function selectedDow() {
    var el = $("iDow");
    if (!el || el.value === "") return null;
    var n = parseInt(el.value, 10);
    return isNaN(n) ? null : n;
  }

  function locMatch(rowLoc, want) {
    if (!want) return true;
    if (!rowLoc) return true;
    var a = String(rowLoc).toUpperCase().replace(/\s+/g, " ");
    var b = String(want).toUpperCase().replace(/\s+/g, " ");
    if (a === b) return true;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
    return false;
  }

  function personFromRow(r, w0, w1, slot) {
    var s = r.s != null ? r.s : w0;
    var e = r.e != null ? r.e : w1;
    if (e <= s) e += 1440;
    var s0 = Math.max(s, w0), e0 = Math.min(e, w1);
    if (e0 - s0 < slot) { s0 = w0; e0 = w1; }
    return {
      k: r.k || ("L" + (r.id || lineName(r))),
      n: lineName(r),
      ti: r.ti || "TSO",
      po: r.po || "TDC",
      sex: r.x || r.sex || "M",
      quals: r.q || r.quals || "1234Z",
      s: s0, e: e0, rawS: s, rawE: e,
      abs: [], trn: [],
      notes: (r.nt && r.nt.slice) ? r.nt.slice() : [],
      restrict: null, pinned: false, mod: null, seat: null,
      preferMod: null,
      shift: r.sh || "",
      fromLine: true,
      dow: r.dow
    };
  }

  function stampNames(people) {
    (people || []).forEach(function (p) { p.n = lineName(p); });
    return people;
  }

  function filterRoster(roster, loc, shift, dow) {
    var want = String(shift || "").toUpperCase();
    return (roster || []).filter(function (r) {
      if (dow != null && r.dow != null && Number(r.dow) !== Number(dow)) return false;
      if (want && r.sh && r.sh !== want) return false;
      if (loc && r.lo && !locMatch(r.lo, loc)) return false;
      return true;
    });
  }

  function ensureLocation(cfg, locId, sample) {
    if (!cfg || !cfg.locations || !locId) return;
    if (cfg.locations[locId]) return;
    var lanes = (sample && sample.lanes && sample.lanes.length) ? sample.lanes : [1, 2];
    var term = String(locId).split("/")[0].replace(/TERMINAL/ig, "").trim() || "A";
    cfg.locations[locId] = {
      t: term.charAt(0),
      open: "03:30",
      close: "23:00",
      mods: [lanes.map(function (n) { return { n: n, ct: 0 }; })],
      kcm: null,
      exit: { am: 0, pm: 0 }
    };
  }

  function injectDayUi() {
    var dateBox = $("iDate");
    if (!dateBox || $("iDow")) return;
    var wrap = dateBox.closest(".grp") || dateBox.parentNode;
    var lab = wrap.querySelector(".lbl");
    if (lab) lab.innerHTML = '<svg class="ic sm"><use href="#i-cal"/></svg>Day of week';
    var sel = document.createElement("select");
    sel.id = "iDow";
    sel.innerHTML = DOW.map(function (d, i) {
      return '<option value="' + i + '">' + d + "</option>";
    }).join("");
    sel.value = "0";
    dateBox.style.display = "none";
    wrap.appendChild(sel);
    sel.addEventListener("change", function () {
      if ($("iDate")) $("iDate").value = "";
    });

    var bar = $("bGenerate") ? $("bGenerate").parentNode : null;
    if (bar && !$("bGenWeek")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-amber";
      btn.id = "bGenWeek";
      btn.textContent = "Generate all locations · 7 days";
      bar.appendChild(btn);
      btn.addEventListener("click", generateAllWeek);
    }
  }

  function wrapStaffFor() {
    if (typeof staffFor !== "function" || staffFor._f7) return;
    var orig = staffFor;
    window.staffFor = function (roster, loc, date, w0, w1, cfg, adj, shift) {
      var dow = selectedDow();
      var slot = (cfg && cfg.rules && cfg.rules.slot) || 30;
      var subset = filterRoster(roster, loc, shift, dow);
      if (!subset.length) subset = filterRoster(roster, "", shift, dow);
      if (!subset.length) subset = filterRoster(roster, "", "", dow);
      var out = subset.map(function (r) { return personFromRow(r, w0, w1, slot); });
      if (!out.length) {
        try { out = orig.apply(this, arguments) || []; } catch (e) { out = []; }
      }
      return stampNames(out);
    };
    staffFor._f7 = true;
  }

  function wrapGenerate() {
    if (typeof generate !== "function" || generate._f7lines) return;
    var orig = generate;
    window.generate = function (newSeed) {
      var RS = window.S;
      if (RS && RS.cfg && RS.cfg.titles) {
        ["TSO", "LTSO", "STSO", "TSO/DFO", "LTSO/DFO", "STSO/DFO", "TSO/BAG", "LTSO/BAG", "STSO/BAG"].forEach(function (t) {
          RS.cfg.titles[t] = 1;
        });
      }
      if (RS && RS.roster && RS.cfg) {
        var seen = {};
        RS.roster.forEach(function (r) {
          if (r.lo && !seen[r.lo]) {
            seen[r.lo] = r;
            ensureLocation(RS.cfg, r.lo, r);
          }
        });
        if (typeof fillLocSelect === "function") fillLocSelect();
        var locEl = $("iLoc");
        if (locEl && !locEl.value) {
          var first = Object.keys(seen)[0];
          if (first) locEl.value = first;
        }
      }
      if ($("iDate")) $("iDate").value = "";
      var res = orig.apply(this, arguments);
      if (RS && RS.sheet && RS.sheet.people) stampNames(RS.sheet.people);
      if (typeof renderSheet === "function" && RS && RS.sheet) renderSheet();
      return res;
    };
    generate._f7lines = true;
  }

  function generateAllWeek() {
    var RS = window.S;
    var Sch = window.Scheduler;
    if (!RS || !RS.roster || !RS.roster.length) {
      if (typeof toast === "function") toast("No line-days yet. Generate BLADE lines and Place teams first.", "err");
      return;
    }
    if (Sch && Sch.placeTeams) Sch.placeTeams();
    if (Sch && Sch.enrichOperationalLines) Sch.enrichOperationalLines();
    if (window.pushLinesToRotation) window.pushLinesToRotation();

    var locs = [];
    var seen = {};
    RS.roster.forEach(function (r) {
      if (r.lo && !seen[r.lo]) { seen[r.lo] = 1; locs.push(r.lo); ensureLocation(RS.cfg, r.lo, r); }
    });
    if (typeof fillLocSelect === "function") fillLocSelect();
    if (!locs.length) {
      if (typeof toast === "function") toast("No placed locations on the line-days.", "err");
      return;
    }

    var shifts = ["AM", "PM"];
    var made = 0;
    DOW.forEach(function (name, day) {
      if ($("iDow")) $("iDow").value = String(day);
      locs.forEach(function (loc) {
        shifts.forEach(function (sh) {
          var rows = filterRoster(RS.roster, loc, sh, day);
          if (!rows.length) return;
          if ($("iLoc")) $("iLoc").value = loc;
          if ($("iShift")) $("iShift").value = sh;
          if ($("iDate")) $("iDate").value = "";
          try {
            generate(true);
            if (RS.sheet) {
              RS.sheet.date = name;
              RS.sheet.dow = day;
              if (typeof saveSheet === "function") saveSheet();
              made++;
            }
          } catch (e) {
            console.warn("gen week", loc, name, sh, e);
          }
        });
      });
    });
    if ($("iDow")) $("iDow").value = "0";
    if (typeof toast === "function") toast("Built " + made + " sheets (locations × days × shifts). Pick a day and location to view.", "ok");
    if (typeof refreshSaved === "function") refreshSaved();
  }

  function boot() {
    injectDayUi();
    wrapStaffFor();
    wrapGenerate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.generateAllWeek = generateAllWeek;
})();

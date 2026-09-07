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
      ti: r.ti || "",
      po: r.po || "TDC",
      sex: (r.x != null && r.x !== "") ? r.x : (r.sex || ""),
      quals: (r.q != null && r.q !== "") ? r.q : (r.quals || ""),
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
    if (!wrap) return;
    var lab = document.createElement("div");
    lab.className = "lbl";
    lab.style.marginTop = "8px";
    lab.textContent = "Day of week (date unused)";
    var sel = document.createElement("select");
    sel.id = "iDow";
    sel.innerHTML = DOW.map(function (d, i) {
      return "<option value=\"" + i + "\">" + d + "</option>";
    }).join("");
    wrap.appendChild(lab);
    wrap.appendChild(sel);
  }

  function staffForWindow(roster, loc, shift, w0, w1, slot) {
    var dow = selectedDow();
    var filtered = filterRoster(roster, loc, shift, dow);
    return stampNames(filtered.map(function (r) {
      return personFromRow(r, w0, w1, slot);
    }));
  }

  function boot() {
    injectDayUi();
    if (typeof window.staffForWindow !== "function") {
      window.staffForWindow = function (roster, loc, shift, w0, w1, slot) {
        return staffForWindow(roster || (window.S && S.roster) || [], loc, shift, w0, w1, slot || 30);
      };
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

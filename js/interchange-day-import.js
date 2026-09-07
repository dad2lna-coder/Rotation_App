(function () {
  var TABS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function $(id) { return document.getElementById(id); }
  function parseClock(s) {
    if (s == null || String(s).trim() === "") return null;
    var t = String(s).trim();
    var m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var d = t.replace(/\D/g, "");
    if (d.length === 3 || d.length === 4) {
      var hh = d.length === 3 ? parseInt(d.slice(0, 1), 10) : parseInt(d.slice(0, 2), 10);
      var mm = d.length === 3 ? parseInt(d.slice(1), 10) : parseInt(d.slice(2), 10);
      if (mm < 60) return hh * 60 + mm;
    }
    return null;
  }
  function parseModNum(modset) {
    if (modset == null || String(modset).trim() === "") return null;
    var m = String(modset).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  function headerGet(row) {
    var map = {};
    Object.keys(row || {}).forEach(function (k) { map[String(k).trim().toLowerCase()] = k; });
    return function (name) {
      var hit = map[String(name).toLowerCase()];
      return hit ? row[hit] : "";
    };
  }
  function isInterchangeWb(wb) {
    if (!wb || !wb.SheetNames) return false;
    var names = wb.SheetNames.map(function (n) { return String(n); });
    return TABS.filter(function (t) { return names.indexOf(t) >= 0; }).length >= 3;
  }
  function rowsFromWb(wb) {
    var imported = [];
    TABS.forEach(function (name, di) {
      var sheet = wb.Sheets[name];
      if (!sheet) return;
      window.XLSX.utils.sheet_to_json(sheet, { defval: "" }).forEach(function (row) {
        var g = headerGet(row);
        imported.push({
          lineKey: String(g("Line Key") || "").trim(),
          line: String(g("Line") || "").trim(),
          position: String(g("Position") || "").trim(),
          sex: String(g("Sex") || "").trim().toUpperCase(),
          day: name, dayIndex: di,
          raw: String(g("Raw") || "").trim(),
          status: String(g("Status") || "").trim() || "WORKING",
          start: String(g("Start") || "").trim(),
          end: String(g("End") || "").trim(),
          team: String(g("Team") || "").trim(),
          location: String(g("Location") || "").trim(),
          modset: String(g("Modset") || "").trim(),
          functionName: String(g("Function") || "").trim()
        });
      });
    });
    return imported;
  }
  function applyImported(imported, fileName) {
    var S = window.Scheduler = window.Scheduler || {};
    if (!S.state) S.state = {};
    S.state.rotationInput = imported.map(function (r) {
      return {
        lineKey: r.lineKey, line: r.line, position: r.position, sex: r.sex,
        day: r.day, dayIndex: r.dayIndex, start: r.start, end: r.end,
        startMin: parseClock(r.start), endMin: parseClock(r.end),
        team: r.team, location: r.location, zone: "",
        modset: r.modset, function: r.functionName,
        status: r.status, raw: r.raw, timeSource: "interchange"
      };
    });
    S.state.rotationInputSource = "interchange";
    var roster = [];
    imported.forEach(function (r) {
      if (/^OFF$/i.test(r.status)) return;
      var startMin = parseClock(r.start);
      var endMin = parseClock(r.end);
      if (startMin == null || endMin == null) return;
      if (endMin <= startMin) endMin += 1440;
      var duty = r.functionName || "";
      if (duty === "PAX") duty = "";
      var title = r.position || "";
      if (duty === "DFO" && title) title += "/DFO";
      if (duty === "BAG" && title) title += "/BAG";
      roster.push({
        k: r.lineKey || r.line, n: r.line || r.lineKey, ti: title,
        po: r.position || "", duty: duty, functionName: duty, position: r.position || "",
        lo: r.location || "", d: "", dow: r.dayIndex,
        sh: startMin < 720 ? "AM" : "PM", s: startMin, e: endMin, x: r.sex || "",
        q: "", ab: [], tr: [], nt: [r.day, r.modset, r.team].filter(Boolean),
        teamId: r.team || "", modset: r.modset || "", preferMod: parseModNum(r.modset),
        generation: 2, fromInterchange: true
      });
    });
    var RS = window.S;
    if (RS) {
      RS.roster = roster;
      RS.meta = { file: fileName || "(interchange workbook)", rows: roster.length, when: "xlsx-import", schema: "blade.interchange.v1" };
      if (typeof DB !== "undefined" && DB.set) { DB.set("roster", RS.roster); DB.set("rosterMeta", RS.meta); }
      if (typeof fillLocSelect === "function") fillLocSelect();
    }
    if (window.BladeInterchange && BladeInterchange.setOverlay) {
      imported.forEach(function (r) {
        BladeInterchange.setOverlay(r.lineKey, r.dayIndex, {
          Position: r.position, Location: r.location, Modset: r.modset,
          Team: r.team, Function: r.functionName, Start: r.start, End: r.end
        });
      });
    }
    var info = $("rosterInfo");
    if (info) info.textContent = roster.length + " working line-days from Interchange. Modset mapped.";
    if (typeof toast === "function") toast("Imported " + roster.length + " working line-days. Modset mapped.", "ok");
    return roster.length;
  }
  function importFile(file) {
    if (!window.XLSX) { alert("XLSX library is not loaded."); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array" });
        if (!isInterchangeWb(wb)) { alert("Not an Interchange workbook. Need Sunday–Saturday tabs."); return; }
        applyImported(rowsFromWb(wb), file && file.name);
      } catch (err) {
        alert("Could not import workbook: " + (err && err.message ? err.message : err));
      }
    };
    reader.readAsArrayBuffer(file);
  }
  function hookRosterPicker() {
    if (typeof window.handleRoster === "function" && !window.handleRoster._ix) {
      var orig = window.handleRoster;
      window.handleRoster = function (file) {
        if (!file || !window.XLSX) return orig.apply(this, arguments);
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var wb = window.XLSX.read(e.target.result, { type: "array" });
            if (isInterchangeWb(wb)) { applyImported(rowsFromWb(wb), file.name); return; }
          } catch (err) {}
          orig.call(window, file);
        };
        reader.readAsArrayBuffer(file);
      };
      window.handleRoster._ix = true;
    }
    var input = $("fRoster");
    if (input && !input._ixHook) {
      input._ixHook = true;
      input.onchange = function (e) {
        var file = e.target.files && e.target.files[0];
        if (file && window.handleRoster) window.handleRoster(file);
        e.target.value = "";
      };
    }
  }
  function hookInterchangeFn() {
    var BI = window.BladeInterchange;
    if (!BI) return;
    BI.importWorkbook = function (file) { importFile(file); };
  }
  function stampPreferMod() {
    if (typeof window.staffFor !== "function" || window.staffFor._modstamp) return;
    var prev = window.staffFor;
    window.staffFor = function () {
      var out = prev.apply(this, arguments) || [];
      var roster = (window.S && window.S.roster) || [];
      var byK = {};
      roster.forEach(function (r) { byK[r.k + "|" + r.dow] = r; });
      out.forEach(function (p) {
        var hit = byK[p.k + "|" + p.dow];
        if (hit && hit.preferMod != null) p.preferMod = hit.preferMod;
        if (hit && hit.modset) p.modset = hit.modset;
      });
      return out;
    };
    window.staffFor._modstamp = true;
  }
  function boot() { hookRosterPicker(); hookInterchangeFn(); stampPreferMod(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 400);
  window.importInterchangeDayWorkbook = importFile;
})();

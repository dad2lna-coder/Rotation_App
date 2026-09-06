(function () {
  var Sch = window.Scheduler;
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function $(id) { return document.getElementById(id); }

  function openRotationConfig() {
    if (Sch && Sch.switchTab) Sch.switchTab("rotation");
    var build = $("buildView"), admin = $("adminView"), side = $("sideBar");
    if (build) build.classList.remove("on");
    if (admin) admin.classList.add("on");
    if (side) side.style.display = "none";
    document.querySelectorAll("#tabSeg .tab").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-v") === "admin");
    });
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

  function applyTitles() {
    var RS = window.S;
    if (!RS || !RS.cfg || !RS.cfg.titles) return;
    RS.cfg.titles["TSO/DFO"] = 1;
    RS.cfg.titles["LTSO/DFO"] = 1;
    RS.cfg.titles["STSO/DFO"] = 1;
    RS.cfg.titles["TSO/BAG"] = 0;
    RS.cfg.titles["LTSO/BAG"] = 0;
  }

  function ensurePlacement() {
    if (!Sch) return null;
    var matrix = Sch.state && Sch.state.placementMatrix;
    if (!matrix || !matrix.rows || !matrix.rows.length) {
      if (typeof Sch.placeTeams === "function") matrix = Sch.placeTeams();
    }
    if (typeof Sch.enrichOperationalLines === "function") Sch.enrichOperationalLines();
    return matrix;
  }

  function locForLineDay(line, di) {
    var gen2 = Sch && Sch.state && Sch.state.operationalLines;
    if (gen2 && gen2.length) {
      for (var i = 0; i < gen2.length; i++) {
        var g = gen2[i];
        if (String(g.id) === String(line.id) && g.day === di && g.placed && g.locKey) return g;
      }
    }
    var teamId = line.teamId;
    if (!teamId && Sch && Sch.teams && Sch.teams.teams) {
      Sch.teams.teams.forEach(function (t) {
        if ((t.members || []).some(function (m) { return String(m) === String(line.id); })) teamId = t.id;
      });
    }
    if (teamId && Sch.placementForTeamDay) return Sch.placementForTeamDay(teamId, di % 7);
    return null;
  }

  function pushLinesToRotation() {
    if (!Sch || !Sch.state || !Sch.state.lines || !Sch.state.lines.length) return;
    ensurePlacement();
    var RS = window.S;
    var rows = [];
    var locCounts = {};
    var unplaced = 0;
    Sch.state.lines.forEach(function (line) {
      var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
      var duties = (Sch.state.functionRotation || {})[String(line.id)] || [];
      var sh = Sch.getShift ? Sch.getShift(line.shiftId) : null;
      var start = sh && Sch.timeToMin ? Sch.timeToMin(sh.start) : 240;
      var end = sh && Sch.timeToMin ? Sch.timeToMin(sh.end) : start + Math.round((line.paid || 8) * 60);
      if (end <= start) end += 1440;
      var role = Sch.lineRoleKey ? Sch.lineRoleKey(line) : (line.empClass || "TSO");
      var shiftName = start < 12 * 60 ? "AM" : "PM";
      var weekLen = sched.length || 7;
      for (var di = 0; di < weekLen; di++) {
        if (sched[di] !== "WORK") continue;
        var duty = duties[di] || duties[di % 7] || line.function || "";
        var title = role;
        if (duty === "DFO") title = role + "/DFO";
        if (duty === "BAG") title = role + "/BAG";
        var home = locForLineDay(line, di);
        var loc = "";
        if (home) loc = home.locKey || home.checkpoint || home.zone || "";
        if (!loc) unplaced++;
        if (loc) locCounts[loc] = (locCounts[loc] || 0) + 1;
        var notes = [];
        if (duty) notes.push(duty + " " + DOW[di % 7]);
        else notes.push(DOW[di % 7]);
        if (home && home.modset) notes.push(home.modset);
        rows.push({
          k: "L" + line.id,
          n: line.lineCode || ("Line " + String(line.id).padStart(3, "0")),
          ti: title,
          po: duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : "TDC",
          lo: loc,
          d: "",
          dow: di % 7,
          sh: shiftName,
          s: start,
          e: end,
          x: line.sex || "M",
          q: "1234Z",
          ab: [],
          tr: [],
          nt: notes,
          teamId: home && home.teamId,
          generation: 2,
          needsPlacement: !loc
        });
      }
    });
    if (!rows.length) return;
    applyTitles();
    if (RS) {
      RS.roster = rows;
      RS.meta = { file: "(Blade Gen-2 lines)", rows: rows.length, when: "f7-place", dates: [], unknown: {}, locs: locCounts };
      if (typeof DB !== "undefined" && DB.set) {
        DB.set("roster", RS.roster);
        DB.set("rosterMeta", RS.meta);
      }
    }
    if ($("rosterInfo")) {
      var extra = unplaced ? (" · " + unplaced + " line-days still unplaced") : "";
      $("rosterInfo").innerHTML = "<b>" + rows.length + "</b> Gen-2 line-days · location from team-home matrix" + extra;
    }
    if ($("iDate")) {
      $("iDate").value = "";
      var lab = $("iDate").previousElementSibling;
      if (lab) lab.innerHTML = "Day of week (date unused)";
    }
    if ($("iLoc")) {
      if (typeof fillLocSelect === "function") fillLocSelect();
      var firstLoc = Object.keys(locCounts)[0] || "";
      if (firstLoc) {
        $("iLoc").value = firstLoc;
        $("iLoc").dispatchEvent(new Event("change"));
      }
    }
    if (Sch.updateStatus) {
      Sch.updateStatus(unplaced
        ? "Gen-2 roster pushed with " + unplaced + " unplaced line-days. Place teams in F7."
        : "Gen-2 operational lines pushed. Open [F7] and Generate Rotation.");
    }
    if (Sch.renderPlacementMatrix) Sch.renderPlacementMatrix();
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
      try {
        if (Sch.placeTeams) Sch.placeTeams();
        if (Sch.enrichOperationalLines) Sch.enrichOperationalLines();
      } catch (e) { console.warn("f7 place", e); }
      try { pushLinesToRotation(); } catch (e) { console.warn("push rotation", e); }
    };
    Sch.generate._bridged = true;
  }

  function hookAirfield() {
    var btn = $("btn-airport-config");
    if (!btn || btn._rotAirfield) return;
    btn._rotAirfield = true;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var modal = $("airport-config-modal");
      if (modal) modal.style.display = "none";
      openRotationConfig();
    }, true);
  }

  function boot() {
    ensureFuncUi();
    wrapGenerate();
    hookAirfield();
    applyTitles();
    if (Sch && Sch.initPlacement) Sch.initPlacement();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.pushLinesToRotation = pushLinesToRotation;
})();

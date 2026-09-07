(function () {
  var Sch = window.Scheduler;
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var Adapter = null;

  function $(id) { return document.getElementById(id); }

  function getAdapter() {
    if (Adapter) return Adapter;
    Adapter = window.BladeLinesAdapter || null;
    return Adapter;
  }

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

  function timesForLineDay(line, di) {
    var ad = getAdapter();
    if (ad) {
      var raw = ad.dayValueOf(line, di);
      var parsed = ad.parseTime(raw);
      if (parsed) {
        return { startMin: parsed.startMin, endMin: parsed.endMin, shiftName: parsed.shift, fromDayCell: true, raw: parsed.raw };
      }
      if (raw != null && String(raw).trim() !== "" && ad.OFF_RE && ad.OFF_RE.test(String(raw).trim())) return null;
      if (raw != null && String(raw).trim() !== "" && !parsed) return null;
    }
    var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
    if (sched[di] !== "WORK") return null;
    var start = 240;
    var end = start + Math.round((line.paid || 8) * 60);
    if (Sch.getEffectiveShiftTimes && line.shiftId) {
      var eff = Sch.getEffectiveShiftTimes(line.shiftId, di);
      if (eff && Sch.timeToMin) { start = Sch.timeToMin(eff.start); end = Sch.timeToMin(eff.end); }
    } else if (Sch.getShift && line.shiftId) {
      var sh = Sch.getShift(line.shiftId);
      if (sh && Sch.timeToMin) { start = Sch.timeToMin(sh.start); end = Sch.timeToMin(sh.end); }
    }
    if (end <= start) end += 1440;
    return { startMin: start, endMin: end, shiftName: start < 12 * 60 ? "AM" : "PM", fromDayCell: false };
  }

  function pushLinesToRotation() {
    if (!Sch || !Sch.state || !Sch.state.lines || !Sch.state.lines.length) return;
    ensurePlacement();
    var RS = window.S;
    var rows = [];
    var locCounts = {};
    var unplaced = 0;
    var skipped = [];
    var ad = getAdapter();

    Sch.state.lines.forEach(function (line, index) {
      var duties = (Sch.state.functionRotation || {})[String(line.id)] || [];
      var role = Sch.lineRoleKey ? Sch.lineRoleKey(line) : (line.position || line.empClass || "TSO");
      var weekLen = 7;
      var sched = Sch.state.schedule[line.id] || Sch.state.schedule[String(line.id)] || [];
      if (sched.length > weekLen) weekLen = sched.length;

      for (var di = 0; di < weekLen; di++) {
        var times = timesForLineDay(line, di % 7);
        if (!times) {
          if (ad) {
            var rawV = ad.dayValueOf(line, di % 7);
            if (rawV != null && String(rawV).trim() !== "") {
              skipped.push({
                index: index,
                line: line.lineCode || ("Line " + String(line.id).padStart(3, "0")),
                raw: String(rawV).trim(),
                day: DOW[di % 7],
                reason: ad.OFF_RE && ad.OFF_RE.test(String(rawV).trim()) ? "non-working" : "unparseable-or-off"
              });
            }
          }
          continue;
        }

        var duty = duties[di] || duties[di % 7] || line.function || "";
        if (duty === "PAX") duty = "";
        var title = role;
        if (duty === "DFO" && role) title = role + "/DFO";
        if (duty === "BAG" && role) title = role + "/BAG";

        var home = locForLineDay(line, di % 7);
        var loc = "";
        if (home) loc = home.locKey || home.checkpoint || home.zone || "";

        var key = ad && ad.lineKey
          ? ad.lineKey(line, index)
          : ("LINE-" + String(line.id != null ? line.id : index + 1).padStart(3, "0"));

        var ov = window.BladeInterchange && BladeInterchange.overlayFor
          ? BladeInterchange.overlayFor(key, di % 7) : null;
        if (ov) {
          if (ov.Location) loc = ov.Location;
          if (ov.Function != null) duty = ov.Function;
          if (ov.Position) role = ov.Position;
        }

        if (!loc) unplaced++;
        if (loc) locCounts[loc] = (locCounts[loc] || 0) + 1;

        var notes = [];
        if (duty) notes.push(duty + " " + DOW[di % 7]);
        else notes.push(DOW[di % 7]);
        if (home && home.modset) notes.push(home.modset);
        if (ov && ov.Modset) notes.push(ov.Modset);

        var sex = "";
        if (line.sex != null && line.sex !== "") sex = String(line.sex).trim().toUpperCase();

        rows.push({
          k: key,
          n: line.lineCode || ("Line " + String(line.id != null ? line.id : index + 1).padStart(3, "0")),
          ti: title,
          po: role || "",
          duty: duty || "",
          functionName: duty || "",
          position: role || "",
          rotationPosition: ov && ov["Rotation Position"] ? ov["Rotation Position"] : "",
          lo: loc,
          d: "",
          dow: di % 7,
          sh: times.shiftName,
          s: times.startMin,
          e: times.endMin,
          x: sex,
          q: "",
          ab: [],
          tr: [],
          nt: notes,
          teamId: (ov && ov.Team) || (home && home.teamId),
          generation: 2,
          needsPlacement: !loc,
          sourceDayValue: times.raw || undefined
        });
      }
    });

    if (!rows.length) {
      if (Sch.updateStatus) Sch.updateStatus("No working line-days to push (all off or unparseable).");
      return;
    }

    applyTitles();
    if (RS) {
      RS.roster = rows;
      RS.meta = {
        file: "(Blade Gen-2 lines)",
        rows: rows.length,
        when: "f7-place",
        dates: [],
        unknown: {},
        locs: locCounts,
        skipped: skipped.length ? skipped : undefined
      };
      if (typeof DB !== "undefined" && DB.set) {
        DB.set("roster", RS.roster);
        DB.set("rosterMeta", RS.meta);
      }
    }
    if ($("rosterInfo")) {
      var extra = unplaced ? (" · " + unplaced + " line-days still unplaced") : "";
      var skipInfo = skipped.length ? (" · " + skipped.length + " skipped") : "";
      $("rosterInfo").innerHTML = "<b>" + rows.length + "</b> Gen-2 line-days · location from team-home matrix" + extra + skipInfo;
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
      try { ensureFuncUi(); } catch (e) { console.warn("func ui", e); }
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

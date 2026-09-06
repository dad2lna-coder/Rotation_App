/** Capacity + daily mod-set coverage assignment */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function cfg() {
    return (S.getAirportConfig && S.getAirportConfig()) || { startTime: "03:30", endTime: "23:00", terminals: [] };
  }
  function toMin(t) { return S.timeToMin ? S.timeToMin(t) : 0; }
  function label(m) { return S.slotLabel ? S.slotLabel(m) : (S.minToTime ? S.minToTime(m) : String(m)); }
  function lanesOf(ms) {
    var n = Number(ms && ms.lanes);
    return Number.isFinite(n) && n >= 0 ? n : 2;
  }
  function rates() {
    var v = cfg().volumePerHour || {};
    var std = Number(v.STD) || 150;
    var pre = Number(v.PRE) || 240;
    var mix = Number(v.MIX);
    if (!Number.isFinite(mix) || mix <= 0) mix = (std + pre) / 2;
    return { STD: std, PRE: pre, MIX: mix };
  }
  function paxHalf(program, n) {
    var r = rates();
    return n * ((r[program] != null ? r[program] : r.STD) / 2);
  }
  function windowOf(node, parent) {
    var start = toMin((node && node.startTime) || (parent && parent.startTime) || cfg().startTime || "03:30");
    var end = toMin((node && node.endTime) || (parent && parent.endTime) || cfg().endTime || "23:00");
    if (end <= start) end += 1440;
    return { start: start, end: end };
  }
  function setOpen(ms, cp, term, slotMin) {
    var win = windowOf(cp, term);
    if (slotMin < win.start || slotMin >= win.end) return false;
    var start = toMin((ms && ms.startTime) || cp.startTime);
    var end = ms && ms.endTime ? toMin(ms.endTime) : win.end;
    if (end <= start) end += 1440;
    return start <= slotMin && slotMin < end;
  }
  function dayNames() { return S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; }

  S.listModSets = function () {
    var out = [];
    (cfg().terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        (cp.modSets || []).forEach(function (ms, idx) {
          if (!ms.name) ms.name = "MS-" + (ms.id != null ? ms.id : idx + 1);
          out.push({
            id: ms.id, name: ms.name, lanes: lanesOf(ms), program: ms.program || "STD", startTime: ms.startTime,
            terminalId: term.id, terminal: term.name, checkpointId: cp.id, checkpoint: cp.name
          });
        });
      });
    });
    return out;
  };

  S.teamSexCounts = function (team) {
    var c = S.teamMemberCounts ? S.teamMemberCounts(team) : null;
    if (c) {
      var m = (c.STSO.M || 0) + (c.LTSO.M || 0) + (c.TSO.M || 0);
      var f = (c.STSO.F || 0) + (c.LTSO.F || 0) + (c.TSO.F || 0);
      return { m: m, f: f, t: m + f };
    }
    return { m: 0, f: 0, t: 0 };
  };

  function memberWorks(mid, day) {
    var sched = (S.state.schedule && (S.state.schedule[mid] || S.state.schedule[String(mid)])) || [];
    return sched[day] === "WORK";
  }

  S.teamWorksDay = function (team, day) {
    var members = (team && team.members) || [];
    if (!members.length) return false;
    var work = 0;
    members.forEach(function (mid) { if (memberWorks(mid, day)) work++; });
    return work >= Math.ceil(members.length / 2);
  };

  S.ensureTeamDayMap = function () {
    if (!S.state.teamDayMod) S.state.teamDayMod = {};
    return S.state.teamDayMod;
  };

  S.modSetForTeamDay = function (teamId, day) {
    var map = S.ensureTeamDayMap();
    var row = map[String(teamId)];
    if (!row) return null;
    return row[day] != null ? row[day] : null;
  };

  S.setTeamDayModSet = function (teamId, day, modSetId) {
    var map = S.ensureTeamDayMap();
    var key = String(teamId);
    if (!map[key]) map[key] = [null, null, null, null, null, null, null];
    map[key][day] = modSetId || null;
  };

  S.assignCoverageByDay = function () {
    var sets = S.listModSets();
    var teams = (S.teams && S.teams.teams) ? S.teams.teams.slice() : [];
    if (!teams.length) return { message: "Form teams first." };
    if (!sets.length) return { message: "Name mod sets in Airfield first." };
    S.ensureTeamDayMap();
    sets = sets.slice().sort(function (a, b) {
      if (b.lanes !== a.lanes) return b.lanes - a.lanes;
      return String(a.name).localeCompare(String(b.name));
    });
    for (var day = 0; day < 7; day++) {
      var working = teams.filter(function (t) { return S.teamWorksDay(t, day); });
      var rot = day % Math.max(working.length, 1);
      var ordered = working.slice(rot).concat(working.slice(0, rot));
      teams.forEach(function (t) { S.setTeamDayModSet(t.id, day, null); });
      var used = {};
      sets.forEach(function (set, si) {
        var pick = null;
        for (var i = 0; i < ordered.length; i++) {
          if (used[ordered[i].id]) continue;
          pick = ordered[i];
          break;
        }
        if (!pick) return;
        used[pick.id] = true;
        S.setTeamDayModSet(pick.id, day, set.id);
      });
      S.balanceDayPairings(day);
    }
    if (S.paintLineColors) S.paintLineColors();
    if (S.renderLines) S.renderLines();
    var msg = "Daily coverage assigned. Teams move sets by day from who is working.";
    if (S.updateStatus) S.updateStatus(msg);
    if (S.renderCapacity) S.renderCapacity();
    return { message: msg };
  };
  S.assignTeamsToModSets = S.assignCoverageByDay;

  S.balanceDayPairings = function (day) {
    var teams = (S.teams && S.teams.teams) || [];
    var sets = S.listModSets();
    var byId = {};
    sets.forEach(function (s) { byId[String(s.id)] = s; });
    var byCp = {};
    teams.forEach(function (t) {
      var msId = S.modSetForTeamDay(t.id, day);
      if (msId == null) return;
      var rec = byId[String(msId)];
      if (!rec) return;
      var k = String(rec.checkpointId);
      if (!byCp[k]) byCp[k] = [];
      byCp[k].push(t);
    });
    Object.keys(byCp).forEach(function (k) {
      var group = byCp[k];
      if (group.length < 2) return;
      var sex = group.map(S.teamSexCounts);
      var needy = null, donor = null;
      group.forEach(function (t, i) {
        if (sex[i].t && sex[i].f === 0) needy = t;
        if (sex[i].f > 0) donor = t;
      });
      if (!needy || !donor || needy === donor) return;
      var a = S.modSetForTeamDay(donor.id, day);
      var b = S.modSetForTeamDay(needy.id, day);
      S.setTeamDayModSet(donor.id, day, b);
      S.setTeamDayModSet(needy.id, day, a);
    });
  };

  S.capacitySlots = function () {
    var c = cfg();
    var open = Math.floor(toMin(c.startTime || "03:30") / 30) * 30;
    var close = Math.ceil(toMin(c.endTime || "23:00") / 30) * 30;
    if (close <= open) close += 1440;
    var out = [];
    for (var m = open; m < close; m += 30) out.push(m);
    return out;
  };

  S.computeLaneCapacityMatrix = function () {
    var c = cfg();
    var slots = S.capacitySlots();
    var cps = [];
    (c.terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        cps.push({ key: "t" + term.id + "c" + cp.id, terminalId: term.id, terminal: term.name, checkpointId: cp.id, checkpoint: cp.name, term: term, cp: cp });
      });
    });
    var rows = slots.map(function (slot) {
      var byCp = {}, byTerm = {}, airportLanes = 0, airportPax = 0;
      cps.forEach(function (col) {
        var lanes = 0, pax = 0;
        (col.cp.modSets || []).forEach(function (ms) {
          if (!setOpen(ms, col.cp, col.term, slot)) return;
          var n = lanesOf(ms);
          lanes += n;
          pax += paxHalf(ms.program || "STD", n);
        });
        byCp[col.key] = { lanes: lanes, pax: pax };
        if (!byTerm[col.terminalId]) byTerm[col.terminalId] = { lanes: 0, pax: 0 };
        byTerm[col.terminalId].lanes += lanes;
        byTerm[col.terminalId].pax += pax;
        airportLanes += lanes;
        airportPax += pax;
      });
      return { slot: slot, time: label(slot), byCheckpoint: byCp, byTerminal: byTerm, airportLanes: airportLanes, airportPax: airportPax };
    });
    var peakLanes = 0, peakPax = 0;
    rows.forEach(function (r) {
      if (r.airportLanes > peakLanes) peakLanes = r.airportLanes;
      if (r.airportPax > peakPax) peakPax = r.airportPax;
    });
    return { checkpoints: cps, terminals: (c.terminals || []).map(function (t) { return { id: t.id, name: t.name }; }), rows: rows, rates: rates(), peakLanes: peakLanes, peakPax: peakPax };
  };
  S.computeCapacity = S.computeLaneCapacityMatrix;

  function heat(n, peak) {
    if (!n) return "hc-0";
    if (peak && n >= peak) return "hc-high";
    if (peak && n <= peak * 0.4) return "hc-low";
    return "hc-ok";
  }
  function num(n) {
    if (!n) return "";
    return Math.round(n * 10) / 10;
  }
  function setName(id) {
    var rec = null;
    S.listModSets().forEach(function (s) { if (String(s.id) === String(id)) rec = s; });
    return rec ? rec.name : "";
  }

  S.renderCapacity = function () {
    var host = S.$("tab-capacity");
    if (!host) return;
    var sets = S.listModSets();
    var matrix = S.computeLaneCapacityMatrix();
    var teams = (S.teams && S.teams.teams) || [];
    var days = dayNames();
    var dayHead = days.map(function (d) { return "<th>" + d + "</th>"; }).join("");
    var coverRows = teams.map(function (t) {
      var cells = "";
      for (var d = 0; d < 7; d++) {
        if (!S.teamWorksDay(t, d)) { cells += "<td style=\"background:#000;color:#fff\">RDO</td>"; continue; }
        var ms = S.modSetForTeamDay(t.id, d);
        cells += "<td>" + (ms != null ? setName(ms) : "—") + "</td>";
      }
      return "<tr><td>" + (t.name || t.id) + "</td>" + cells + "</tr>";
    }).join("") || '<tr><td class="muted" colspan="8">Form teams, then assign daily coverage.</td></tr>';

    var r = matrix.rates;
    var filter = (S.$("cap-filter-term") && S.$("cap-filter-term").value) || "";
    var cols = matrix.checkpoints.filter(function (c) { return !filter || String(c.terminalId) === String(filter); });
    var opts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      opts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" + String(t.name).replace(/</g, "<") + "</option>";
    });
    var head = "<tr><th>Time</th>";
    var seen = {};
    cols.forEach(function (c) {
      if (!seen[c.terminalId]) { seen[c.terminalId] = 1; head += '<th class="muted">' + c.terminal + "</th>"; }
      head += "<th>" + c.checkpoint + " lanes</th><th>" + c.checkpoint + " pax/30</th>";
    });
    head += "<th>Airport lanes</th><th>Airport pax/30</th></tr>";
    var body = matrix.rows.map(function (row) {
      var html = "<td>" + row.time + "</td>";
      seen = {};
      cols.forEach(function (c) {
        if (!seen[c.terminalId]) {
          seen[c.terminalId] = 1;
          var tv = row.byTerminal[c.terminalId] || { lanes: 0 };
          html += '<td class="' + heat(tv.lanes, matrix.peakLanes) + '"><strong>' + (tv.lanes || "") + "</strong></td>";
        }
        var cell = row.byCheckpoint[c.key] || { lanes: 0, pax: 0 };
        html += '<td class="' + heat(cell.lanes, matrix.peakLanes) + '">' + (cell.lanes || "") + "</td>";
        html += '<td class="' + heat(cell.pax, matrix.peakPax) + '">' + num(cell.pax) + "</td>";
      });
      html += "<td><strong>" + (row.airportLanes || "") + "</strong></td><td><strong>" + num(row.airportPax) + "</strong></td>";
      return "<tr>" + html + "</tr>";
    }).join("");

    host.innerHTML =
      '<div class="card"><div class="section-title">Daily coverage (team → mod set)</div>' +
      '<p class="muted">A team does not live on one set. Each day we take who is working and fill the hungriest sets first. Pairings can change day to day.</p>' +
      '<div class="toolbar"><button type="button" class="btn btn-amber" id="btn-assign-ms">Assign daily coverage</button>' +
      '<span class="muted" id="ms-assign-hint">Uses working members that day, not a locked home set.</span></div>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Team</th>' + dayHead + "</tr></thead><tbody>" +
      coverRows + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Half-hour throughput</div>' +
      '<p class="muted">STD ' + r.STD + " · PRE " + r.PRE + " · MIX " + r.MIX + " /lane/hr</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table cov-matrix"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div>";
    var sel = S.$("cap-filter-term");
    if (sel) sel.addEventListener("change", function () { S.renderCapacity(); });
    var btn = S.$("btn-assign-ms");
    if (btn) btn.addEventListener("click", function () {
      var out = S.assignCoverageByDay();
      var hint = S.$("ms-assign-hint");
      if (hint) hint.textContent = out.message;
    });
  };

  S.initCapacity = function () {
    if (typeof S.switchTab === "function" && !S._capacityTabWrapped) {
      S._capacityTabWrapped = true;
      var orig = S.switchTab;
      S.switchTab = function (name) {
        orig(name);
        if (name === "capacity") S.renderCapacity();
      };
    }
    S.renderCapacity();
  };
})(window.Scheduler);

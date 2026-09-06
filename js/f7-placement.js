/** F7 placement engine — team-day homes, then Gen-2 operational lines */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function teamsList() {
    return (S.teams && S.teams.teams) ? S.teams.teams.slice() : [];
  }

  function teamOfLine(line) {
    var tid = line && (line.teamId || line.team);
    if (tid) return S.getTeamById ? S.getTeamById(tid) : null;
    var teams = teamsList();
    for (var i = 0; i < teams.length; i++) {
      var mem = teams[i].members || [];
      for (var j = 0; j < mem.length; j++) {
        if (String(mem[j]) === String(line.id)) return teams[i];
      }
    }
    return null;
  }

  function teamComposition(team) {
    var c = S.teamMemberCounts ? S.teamMemberCounts(team) : null;
    if (c) {
      return {
        stso: (c.STSO.M || 0) + (c.STSO.F || 0),
        ltso: (c.LTSO.M || 0) + (c.LTSO.F || 0),
        tso: (c.TSO.M || 0) + (c.TSO.F || 0),
        f: (c.STSO.F || 0) + (c.LTSO.F || 0) + (c.TSO.F || 0),
        m: (c.STSO.M || 0) + (c.LTSO.M || 0) + (c.TSO.M || 0),
        total: c.total || 0
      };
    }
    return { stso: 0, ltso: 0, tso: 0, f: 0, m: 0, total: 0 };
  }

  function workingMembers(team, day) {
    var n = 0;
    (team.members || []).forEach(function (mid) {
      var sched = (S.state.schedule && (S.state.schedule[mid] || S.state.schedule[String(mid)])) || [];
      if (sched[day] === "WORK") n++;
    });
    return n;
  }

  function teamStartMin(team) {
    var info = S.teamPhaseInfo ? S.teamPhaseInfo(team) : null;
    if (info && info.startMin != null && info.startMin < 24 * 60) return info.startMin;
    return 4 * 60;
  }

  function toMin(t) {
    return S.timeToMin ? S.timeToMin(t) : 0;
  }

  function airportCfg() {
    return (S.getAirportConfig && S.getAirportConfig()) || { terminals: [] };
  }

  function homeCatalog() {
    var homes = [];
    var cfg = airportCfg();
    (cfg.terminals || []).forEach(function (term) {
      var cost = term.baseTSOCost || { STD: 6, PRE: 5, MIX: 6 };
      (term.checkpoints || []).forEach(function (cp) {
        (cp.modSets || []).forEach(function (ms, idx) {
          var lanes = Number(ms.lanes);
          if (!Number.isFinite(lanes) || lanes < 1) lanes = 2;
          var program = ms.program || "STD";
          var tsoPer = Number(cost[program]);
          if (!Number.isFinite(tsoPer) || tsoPer <= 0) tsoPer = 6;
          homes.push({
            id: ms.id != null ? ms.id : "ms-" + term.id + "-" + cp.id + "-" + idx,
            name: ms.name || ("MS-" + (ms.id != null ? ms.id : idx + 1)),
            terminalId: term.id,
            terminal: term.name,
            zone: cp.name,
            checkpointId: cp.id,
            checkpoint: cp.name,
            modsetId: ms.id,
            modset: ms.name || ("Modset " + (ms.id != null ? ms.id : idx + 1)),
            lanes: lanes,
            program: program,
            tsoNeed: lanes * tsoPer,
            startMin: toMin(ms.startTime || cp.startTime || term.startTime || "03:30"),
            endMin: toMin(cp.endTime || term.endTime || "23:00"),
            locKey: String(term.name || "") + " / " + String(cp.name || "")
          });
        });
      });
    });
    return homes;
  }

  function scorePair(team, home, day, remainingNeed) {
    var comp = teamComposition(team);
    var work = workingMembers(team, day);
    var start = teamStartMin(team);
    var score = 0;
    var reasons = [];
    if (work <= 0) return { score: -1e9, reasons: ["RDO"], work: 0, comp: comp };
    var sizeGap = Math.abs((comp.tso || work) - remainingNeed);
    score += Math.max(0, 80 - sizeGap * 6);
    if (sizeGap <= 2) reasons.push("size-fit");
    if (comp.stso > 0) { score += 18; reasons.push("STSO"); }
    else score -= 12;
    if (comp.ltso > 0) { score += 12; reasons.push("LTSO"); }
    if (home.program === "PRE" && comp.f > 0) { score += 10; reasons.push("PRE-F"); }
    if (comp.f === 0) score -= 6;
    var delta = Math.abs(start - home.startMin);
    score += Math.max(0, 30 - delta / 10);
    if (delta <= 30) reasons.push("shift-window");
    if (start > home.startMin + 90) { score -= 20; reasons.push("late-for-open"); }
    var phase = (S.teamPhaseInfo && S.teamPhaseInfo(team).phase) || "";
    if (phase === "Opening" && home.startMin <= 5 * 60) { score += 16; reasons.push("opener"); }
    if (phase === "Closing" && home.endMin >= 20 * 60) { score += 12; reasons.push("closer"); }
    score += Math.min(home.lanes, 6) * 2;
    return { score: score, reasons: reasons, work: work, comp: comp };
  }

  function emptyMatrix() {
    return { days: DOW.slice(), homes: [], byTeam: {}, rows: [], generation: 1 };
  }

  function laneList(n) {
    var out = [];
    for (var i = 1; i <= n; i++) out.push(i);
    return out;
  }

  S.placeTeams = function () {
    var homes = homeCatalog();
    var teams = teamsList();
    var matrix = emptyMatrix();
    matrix.homes = homes.map(function (h) {
      return { id: h.id, terminal: h.terminal, zone: h.zone, modset: h.modset, lanes: h.lanes, program: h.program, tsoNeed: h.tsoNeed };
    });
    if (!S.state) S.state = {};
    if (!teams.length) {
      matrix.message = "Form teams first.";
      S.state.placementMatrix = matrix;
      return matrix;
    }
    if (!homes.length) {
      matrix.message = "Configure terminals / checkpoints / modsets in Airfield first.";
      S.state.placementMatrix = matrix;
      return matrix;
    }
    if (S.ensureTeamDayMap) S.ensureTeamDayMap();
    for (var day = 0; day < 7; day++) {
      var working = teams.filter(function (t) {
        return S.teamWorksDay ? S.teamWorksDay(t, day) : workingMembers(t, day) > 0;
      });
      teams.forEach(function (t) {
        if (S.setTeamDayModSet) S.setTeamDayModSet(t.id, day, null);
      });
      var remaining = {};
      homes.forEach(function (h) { remaining[h.id] = h.tsoNeed; });
      var usedTeam = {};
      var hunger = homes.slice().sort(function (a, b) {
        if (b.tsoNeed !== a.tsoNeed) return b.tsoNeed - a.tsoNeed;
        return a.startMin - b.startMin;
      });
      hunger.forEach(function (home) {
        var guard = 0;
        while (remaining[home.id] > 0 && guard++ < working.length) {
          var best = null, bestSc = null;
          working.forEach(function (t) {
            if (usedTeam[t.id]) return;
            var sc = scorePair(t, home, day, remaining[home.id]);
            if (!best || sc.score > bestSc.score) { best = t; bestSc = sc; }
          });
          if (!best || bestSc.score < -100) break;
          usedTeam[best.id] = true;
          remaining[home.id] = Math.max(0, remaining[home.id] - Math.max(bestSc.comp.tso, bestSc.work));
          if (S.setTeamDayModSet) S.setTeamDayModSet(best.id, day, home.modsetId != null ? home.modsetId : home.id);
          var place = {
            teamId: best.id, teamName: best.name || best.id, day: day, dow: DOW[day],
            terminal: home.terminal, zone: home.zone, checkpoint: home.checkpoint,
            modset: home.modset, modsetId: home.modsetId != null ? home.modsetId : home.id,
            lanes: laneList(home.lanes), program: home.program, locKey: home.locKey,
            score: Math.round(bestSc.score), reason: bestSc.reasons.join(","), work: bestSc.work
          };
          if (!matrix.byTeam[best.id]) matrix.byTeam[best.id] = [null, null, null, null, null, null, null];
          matrix.byTeam[best.id][day] = place;
          matrix.rows.push(place);
        }
      });
      if (S.balanceDayPairings) S.balanceDayPairings(day);
      working.forEach(function (t) {
        var msId = S.modSetForTeamDay ? S.modSetForTeamDay(t.id, day) : null;
        if (msId == null) return;
        var home = null;
        homes.forEach(function (h) {
          if (String(h.modsetId != null ? h.modsetId : h.id) === String(msId)) home = h;
        });
        if (!home) return;
        var existing = matrix.byTeam[t.id] && matrix.byTeam[t.id][day];
        if (existing && String(existing.modsetId) === String(msId)) return;
        var sc = scorePair(t, home, day, home.tsoNeed);
        var place = {
          teamId: t.id, teamName: t.name || t.id, day: day, dow: DOW[day],
          terminal: home.terminal, zone: home.zone, checkpoint: home.checkpoint,
          modset: home.modset, modsetId: msId, lanes: laneList(home.lanes),
          program: home.program, locKey: home.locKey,
          score: Math.round(sc.score), reason: (sc.reasons.concat(["balanced"])).join(","), work: sc.work
        };
        if (!matrix.byTeam[t.id]) matrix.byTeam[t.id] = [null, null, null, null, null, null, null];
        matrix.byTeam[t.id][day] = place;
        var replaced = false;
        matrix.rows = matrix.rows.map(function (r) {
          if (r.teamId === t.id && r.day === day) { replaced = true; return place; }
          return r;
        });
        if (!replaced) matrix.rows.push(place);
      });
    }
    matrix.message = "Placed " + matrix.rows.length + " team-days across " + homes.length + " homes.";
    S.state.placementMatrix = matrix;
    if (S.paintLineColors) S.paintLineColors();
    if (S.renderLines) S.renderLines();
    if (S.updateStatus) S.updateStatus(matrix.message);
    return matrix;
  };

  S.placementForTeamDay = function (teamId, day) {
    var m = S.state && S.state.placementMatrix;
    if (!m || !m.byTeam) return null;
    var row = m.byTeam[String(teamId)] || m.byTeam[teamId];
    if (!row) return null;
    return row[day] || null;
  };

  S.enrichOperationalLines = function () {
    if (!S.state || !S.state.placementMatrix) S.placeTeams();
    var lines = (S.state && S.state.lines) || [];
    var gen2 = [];
    lines.forEach(function (line) {
      var team = teamOfLine(line);
      var teamId = team ? team.id : (line.teamId || null);
      var sched = (S.state.schedule && (S.state.schedule[line.id] || S.state.schedule[String(line.id)])) || [];
      var duties = (S.state.functionRotation || {})[String(line.id)] || [];
      var weekLen = sched.length || 7;
      for (var di = 0; di < weekLen; di++) {
        if (sched[di] !== "WORK") continue;
        var home = teamId ? S.placementForTeamDay(teamId, di % 7) : null;
        gen2.push({
          id: line.id,
          lineCode: line.lineCode || ("L" + line.id),
          teamId: teamId,
          role: S.lineRoleKey ? S.lineRoleKey(line) : (line.empClass || "TSO"),
          sex: line.sex || "M",
          shiftId: line.shiftId,
          function: duties[di] || duties[di % 7] || line.function || "",
          terminal: home ? home.terminal : "",
          zone: home ? home.zone : "",
          checkpoint: home ? home.checkpoint : "",
          modset: home ? home.modset : "",
          modsetId: home ? home.modsetId : null,
          lanes: home ? home.lanes.slice() : [],
          locKey: home ? home.locKey : "",
          day: di,
          dow: DOW[di % 7],
          generation: 2,
          placed: !!home
        });
      }
    });
    S.state.operationalLines = gen2;
    return gen2;
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  S.renderPlacementMatrix = function () {
    var host = S.$("f7-placement-host");
    if (!host) return;
    var m = (S.state && S.state.placementMatrix) || emptyMatrix();
    var days = DOW;
    var teams = teamsList();
    var body = teams.map(function (t) {
      var cells = "";
      for (var d = 0; d < 7; d++) {
        var works = S.teamWorksDay ? S.teamWorksDay(t, d) : workingMembers(t, d) > 0;
        if (!works) { cells += '<td class="f7-rdo">RDO</td>'; continue; }
        var p = S.placementForTeamDay(t.id, d);
        if (!p) { cells += "<td>—</td>"; continue; }
        cells += "<td title=\"" + (p.reason || "") + " score " + p.score + "\">" +
          escapeHtml(p.zone) + "<br><span class=\"muted\">" + escapeHtml(p.modset) +
          " · L" + (p.lanes && p.lanes.length ? p.lanes[0] + "–" + p.lanes[p.lanes.length - 1] : "") +
          "</span></td>";
      }
      return "<tr><td>" + escapeHtml(t.name || t.id) + "</td>" + cells + "</tr>";
    }).join("") || '<tr><td class="muted" colspan="8">Generate lines and form teams, then Place teams.</td></tr>';
    host.innerHTML =
      '<div class="card" id="f7-placement-card"><div class="section-title">F7 team homes (7-day matrix)</div>' +
      '<p class="muted">BLADE builds people and days. F7 assigns each working team a home for that day, then stamps every member. No default checkpoint.</p>' +
      '<div class="toolbar"><button type="button" class="btn btn-amber" id="btn-f7-place">Place teams</button>' +
      '<span class="muted" id="f7-place-hint">' + escapeHtml(m.message || "Not placed yet") + "</span></div>" +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Team</th>' +
      days.map(function (d) { return "<th>" + d + "</th>"; }).join("") +
      "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
    var btn = S.$("btn-f7-place");
    if (btn) btn.addEventListener("click", function () {
      S.placeTeams();
      S.enrichOperationalLines();
      if (window.pushLinesToRotation) window.pushLinesToRotation();
      S.renderPlacementMatrix();
      if (S.renderCapacity) S.renderCapacity();
    });
  };

  S.initPlacement = function () {
    if (typeof S.assignCoverageByDay === "function" && !S.assignCoverageByDay._f7) {
      S.assignCoverageByDay = function () {
        var m = S.placeTeams();
        if (S.enrichOperationalLines) S.enrichOperationalLines();
        if (window.pushLinesToRotation) { try { window.pushLinesToRotation(); } catch (e) {} }
        if (S.renderCapacity) S.renderCapacity();
        return { message: (m && m.message) || "Placed." };
      };
      S.assignCoverageByDay._f7 = true;
      S.assignTeamsToModSets = S.assignCoverageByDay;
    }
    ensureHost();
    S.renderPlacementMatrix();
    if (typeof S.switchTab === "function" && !S._placementTabWrapped) {
      S._placementTabWrapped = true;
      var orig = S.switchTab;
      S.switchTab = function (name) {
        orig.apply(this, arguments);
        if (name === "rotation" || name === "capacity") {
          ensureHost();
          S.renderPlacementMatrix();
        }
      };
    }
  };

  function ensureHost() {
    var rot = S.$("tab-rotation");
    if (rot && !S.$("f7-placement-host")) {
      var wrap = document.createElement("div");
      wrap.id = "f7-placement-host";
      rot.insertBefore(wrap, rot.firstChild);
    }
  }
})(window.Scheduler);

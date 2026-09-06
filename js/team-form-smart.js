/** Smarter auto-form + RDO sex balance (web). */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  if (!S.teams) S.teams = {};
  S.teams.formOpts = S.teams.formOpts || {
    startWindowMin: 30,
    allowOneRdo: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function timeToMin(t) {
    if (S.timeToMin) return S.timeToMin(t);
    var m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]);
  }

  function parseRdoDays(p) {
    if (p && Array.isArray(p.rdoDays)) {
      return p.rdoDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    }
    if (p && Array.isArray(p.line && p.line.rdoDays)) {
      return p.line.rdoDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    }
    var raw = p && p.rdo != null ? String(p.rdo) : "";
    if (!raw) return [];
    return raw.split(/[/,]+/).map(function (x) { return parseInt(x, 10); }).filter(function (d) {
      return d >= 0 && d <= 6;
    });
  }

  function startMins(p) {
    if (p && p.startMin != null && p.startMin !== "") return +p.startMin;
    return timeToMin(p && p.start);
  }

  function startsClose(a, b, windowMin) {
    var ma = startMins(a);
    var mb = startMins(b);
    if (ma == null || mb == null) return String(a.start || "") === String(b.start || "");
    var diff = Math.abs(ma - mb);
    var wrap = Math.min(diff, 24 * 60 - diff);
    return wrap <= windowMin;
  }

  function rdoOverlap(a, b) {
    var da = parseRdoDays(a);
    var db = parseRdoDays(b);
    var set = {};
    da.forEach(function (d) { set[d] = true; });
    var n = 0;
    db.forEach(function (d) { if (set[d]) n++; });
    return n;
  }

  function rdoExact(a, b) {
    var ka = parseRdoDays(a).slice().sort().join(",");
    var kb = parseRdoDays(b).slice().sort().join(",");
    return ka === kb && ka !== "";
  }

  function injectControls() {
    var bar = $("team-architecture");
    if (!bar || $("form-start-window")) return;
    var wrap = document.createElement("span");
    wrap.className = "team-form-opts";
    wrap.style.cssText = "display:inline-flex;flex-wrap:wrap;gap:0.6rem;align-items:center;";
    wrap.innerHTML =
      '<label title="Treat nearby start times as the same crew window">Start window (min) ' +
      '<input type="number" id="form-start-window" min="0" max="180" step="15" value="' +
      S.teams.formOpts.startWindowMin +
      '" style="width:4rem"></label>' +
      '<label class="follow-me-label" title="Also place people who share at least one RDO day and fall in the start window">' +
      '<input type="checkbox" id="form-allow-one-rdo"> Allow 1 matching RDO</label>';
    var hint = $("arch-hint");
    if (hint) bar.insertBefore(wrap, hint);
    else bar.appendChild(wrap);
    $("form-start-window").addEventListener("change", function () {
      S.teams.formOpts.startWindowMin = Math.max(0, Math.min(180, +this.value || 0));
    });
    $("form-allow-one-rdo").addEventListener("change", function () {
      S.teams.formOpts.allowOneRdo = !!this.checked;
    });
  }

  function sexOf(p) {
    return p && p.sex === "F" ? "F" : "M";
  }

  function teamSexScore(team, candidate) {
    var c = S.teamMemberCounts(team);
    var m = c.STSO.M + c.LTSO.M + c.TSO.M;
    var f = c.STSO.F + c.LTSO.F + c.TSO.F;
    if (sexOf(candidate) === "F") f++;
    else m++;
    var tot = m + f;
    return Math.abs(m - f) / Math.max(1, tot);
  }

  function roleSexScore(team, role, candidate) {
    var c = S.teamMemberCounts(team);
    var m = c[role].M;
    var f = c[role].F;
    if (sexOf(candidate) === "F") f++;
    else m++;
    return Math.abs(m - f) / Math.max(1, m + f);
  }

  function lineRole(l) {
    if (S.lineRoleKey) return S.lineRoleKey(l);
    if (l.isStso || l.empClass === "STSO") return "STSO";
    if (l.isLtso || l.empClass === "LTSO") return "LTSO";
    return "TSO";
  }

  function rdoImbalance(lines) {
    var mTot = 0, fTot = 0;
    var mDay = [0, 0, 0, 0, 0, 0, 0];
    var fDay = [0, 0, 0, 0, 0, 0, 0];
    lines.forEach(function (l) {
      var sx = sexOf(l);
      if (sx === "F") fTot++;
      else mTot++;
      parseRdoDays(l).forEach(function (d) {
        if (sx === "F") fDay[d]++;
        else mDay[d]++;
      });
    });
    var score = 0;
    for (var d = 0; d < 7; d++) {
      var mShare = mTot ? mDay[d] / mTot : 0;
      var fShare = fTot ? fDay[d] / fTot : 0;
      score += Math.abs(mShare - fShare);
    }
    return score;
  }

  function cloneDays(arr) {
    return (arr || []).slice();
  }

  /** Swap RDO patterns among same-role, same-length, non-hard lines to even sex by weekday. */
  S.rebalanceRdoBySex = function () {
    var lines = (S.state && S.state.lines) || [];
    if (!lines.length) return 0;
    var days = (S.state.weekCount || 1) * 7;
    var swapped = 0;
    ["STSO", "LTSO", "TSO"].forEach(function (role) {
      var group = lines.filter(function (l) {
        return lineRole(l) === role && !l.rdoHard;
      });
      var improved = true;
      var guard = 0;
      while (improved && guard++ < 80) {
        improved = false;
        var best = null;
        var base = rdoImbalance(group);
        for (var i = 0; i < group.length; i++) {
          for (var j = i + 1; j < group.length; j++) {
            var a = group[i], b = group[j];
            if (sexOf(a) === sexOf(b)) continue;
            if ((a.rdoDays || []).length !== (b.rdoDays || []).length) continue;
            var da = cloneDays(a.rdoDays), db = cloneDays(b.rdoDays);
            if (da.slice().sort().join() === db.slice().sort().join()) continue;
            a.rdoDays = db;
            b.rdoDays = da;
            var next = rdoImbalance(group);
            a.rdoDays = da;
            b.rdoDays = db;
            if (next + 0.0001 < base && (!best || next < best.score)) {
              best = { a: a, b: b, da: da, db: db, score: next };
            }
          }
        }
        if (best) {
          best.a.rdoDays = best.db;
          best.b.rdoDays = best.da;
          if (S.buildScheduleForLine && S.state.schedule) {
            S.state.schedule[best.a.id] = S.buildScheduleForLine(best.a, days);
            S.state.schedule[best.b.id] = S.buildScheduleForLine(best.b, days);
          }
          swapped++;
          improved = true;
        }
      }
    });
    return swapped;
  };

  if (typeof S.generate === "function" && !S.generate._sexRdoWrapped) {
    var origGen = S.generate;
    S.generate = function () {
      var r = origGen.apply(this, arguments);
      var n = S.rebalanceRdoBySex();
      if (n && S.updateStatus) {
        S.updateStatus((S.$("status") && S.$("status").textContent ? S.$("status").textContent + " · " : "") +
          "RDO sex-balanced (" + n + " swap" + (n === 1 ? "" : "s") + ")");
      }
      if (n && S.renderAll) S.renderAll();
      return r;
    };
    S.generate._sexRdoWrapped = true;
  }

  S.autoFormTeams = function () {
    S.collectTeamPool();
    var pool = S.teams.pool.slice();
    if (!pool.length) {
      if (S.updateStatus) S.updateStatus("Generate a schedule first so there are lines to group.");
      return;
    }
    var stsoPer = Math.max(0, +(S.$("arch-stso") && S.$("arch-stso").value) || 1);
    var ltsoPer = Math.max(0, +(S.$("arch-ltso") && S.$("arch-ltso").value) || 0);
    var tsoPer = Math.max(0, +(S.$("arch-tso") && S.$("arch-tso").value) || 0);
    var windowMin = Math.max(0, +((S.$("form-start-window") && S.$("form-start-window").value) || S.teams.formOpts.startWindowMin || 0));
    var allowOne = !!(S.$("form-allow-one-rdo") && S.$("form-allow-one-rdo").checked);
    S.teams.formOpts.startWindowMin = windowMin;
    S.teams.formOpts.allowOneRdo = allowOne;

    var byRole = { STSO: [], LTSO: [], TSO: [] };
    pool.forEach(function (p) {
      if (byRole[p.role]) byRole[p.role].push(p);
      else byRole.TSO.push(p);
    });
    var nTeams = byRole.STSO.length;
    if (!nTeams) {
      if (S.updateStatus) S.updateStatus("No STSO lines — cannot auto-form (teams = # of STSOs).");
      return;
    }

    S.teams.teams = [];
    for (var i = 0; i < nTeams; i++) S.createTeam();

    var used = {};
    function roleNeed(team, role) {
      var c = S.teamMemberCounts(team);
      var have = c[role].M + c[role].F;
      var target = role === "STSO" ? stsoPer : role === "LTSO" ? ltsoPer : tsoPer;
      return Math.max(0, target - have);
    }
    function teamAnchor(team) {
      if (!team.members || !team.members.length) return null;
      return S.memberLine(team.members[0]);
    }
    function matchQuality(p, anchor) {
      if (!p || !anchor) return 0;
      if (!startsClose(p, anchor, windowMin)) return 0;
      if (rdoExact(p, anchor)) return 3;
      if (allowOne && rdoOverlap(p, anchor) >= 1) return 1;
      return 0;
    }
    function oppositeSup(p, anchor, role) {
      if (role !== "LTSO" && role !== "STSO") return 0;
      if (!anchor) return 0;
      return sexOf(p) !== sexOf(anchor) ? 1 : 0;
    }

    byRole.STSO.sort(function (a, b) {
      var sa = startMins(a) != null ? startMins(a) : 0;
      var sb = startMins(b) != null ? startMins(b) : 0;
      if (sa !== sb) return sa - sb;
      return String(a.rdo || "").localeCompare(String(b.rdo || ""));
    });

    byRole.STSO.forEach(function (p, idx) {
      var team = S.teams.teams[idx];
      if (!team) return;
      team.members.push(p.id);
      used[p.id] = true;
      team.name = S.padTeamNum ? S.padTeamNum(idx + 1, Math.max(2, String(nTeams).length)) : String(idx + 1);
    });
    if (S.renumberTeamsByStart) S.renumberTeamsByStart();

    function assignRole(role) {
      var candidates = byRole[role].filter(function (p) { return !used[p.id]; });
      candidates.sort(function (a, b) {
        if (sexOf(a) !== sexOf(b)) return sexOf(a) === "F" ? -1 : 1;
        var sa = startMins(a) != null ? startMins(a) : 0;
        var sb = startMins(b) != null ? startMins(b) : 0;
        return sa - sb;
      });

      candidates.forEach(function (p) {
        var scored = [];
        S.teams.teams.forEach(function (t) {
          if (roleNeed(t, role) <= 0) return;
          var anchor = teamAnchor(t);
          var q = matchQuality(p, anchor);
          if (!q) return;
          scored.push({
            team: t,
            q: q,
            opp: oppositeSup(p, anchor, role),
            need: roleNeed(t, role),
            teamSex: teamSexScore(t, p),
            roleSex: roleSexScore(t, role, p)
          });
        });
        if (!scored.length) return;
        scored.sort(function (a, b) {
          if (b.q !== a.q) return b.q - a.q;
          if (b.opp !== a.opp) return b.opp - a.opp;
          if (a.teamSex !== b.teamSex) return a.teamSex - b.teamSex;
          if (a.roleSex !== b.roleSex) return a.roleSex - b.roleSex;
          return b.need - a.need;
        });
        scored[0].team.members.push(p.id);
        used[p.id] = true;
      });
    }

    assignRole("STSO");
    assignRole("LTSO");
    assignRole("TSO");

    var assignedN = Object.keys(used).length;
    var leftN = pool.length - assignedN;
    S.renderTeams();
    if (S.renderLines) S.renderLines();
    if (S.updateStatus) {
      S.updateStatus(
        "Auto-formed " + nTeams + " team(s) · window " + windowMin + " min" +
          (allowOne ? " · 1-RDO allowed" : " · exact RDO") +
          " · opposite STSO/LTSO sex preferred · " + assignedN + " assigned · " + leftN + " in pool"
      );
    }
  };

  function init() {
    injectControls();
    if (typeof S.generate === "function" && !S.generate._sexRdoWrapped) {
      var origGen = S.generate;
      S.generate = function () {
        var r = origGen.apply(this, arguments);
        var n = S.rebalanceRdoBySex();
        if (n && S.renderAll) S.renderAll();
        return r;
      };
      S.generate._sexRdoWrapped = true;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);

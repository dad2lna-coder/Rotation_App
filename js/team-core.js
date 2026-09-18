/** Consolidated Teams Module for BLADE Alpha Build - FINAL CORRECTED */

window.Scheduler = window.Scheduler || {};

(function (S) {
  "use strict";
  S.$ = S.$ || function (id) { return document.getElementById(id); };
  function sexOf(p) { return p && p.sex === "F" ? "F" : "M"; }
  var ROLES = ["TSO", "LTSO", "STSO"];
  var teamSeq = 1;
  S.teams = S.teams || { teams: [], pool: [], filters: { role: "ALL", start: "", rdo: "" }, selected: {}, sortables: [], followMe: false, buildOpen: false };
  if (!S.teams.sortables) S.teams.sortables = [];
  if (typeof S.teams.followMe !== "boolean") S.teams.followMe = false;
  if (typeof S.teams.buildOpen !== "boolean") S.teams.buildOpen = false;
  function roleOf(line) { if (line.isStso) return "STSO"; if (line.isLtso) return "LTSO"; return "TSO"; }
  function rdoKey(line) { return (line.rdoDays || []).slice().sort(function (a, b) { return a - b; }).join(","); }
  function rdoLabel(line) { var days = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; var k = rdoKey(line); if (!k) return "—"; return k.split(",").map(function (i) { return days[+i] || i; }).join(","); }
  function startOf(line) { var sh = S.getShift ? S.getShift(line.shiftId) : null; return sh ? S.timeToMin(sh.start) : 0; }
  function startLabel(line) { var sh = S.getShift ? S.getShift(line.shiftId) : null; return sh ? sh.start : "—"; }
  S.teamRoleOf = roleOf; S.teamRdoKey = rdoKey; S.teamRdoLabel = rdoLabel; S.teamStartOf = startOf; S.teamStartLabel = startLabel;
  
  S.collectTeamPool = function () {
    var lines = (S.state && S.state.lines) ? S.state.lines : [];
    S.teams.pool = lines.map(function (l) {
      return { id: l.id, lineCode: l.lineCode || ("L" + l.id), role: roleOf(l), start: startLabel(l), startMin: startOf(l), rdo: rdoKey(l), rdoLabel: rdoLabel(l), sex: l.sex || "—", empClass: l.empClass || "", shiftId: l.shiftId, shiftName: l.shiftName || (S.getShift && S.getShift(l.shiftId) ? S.getShift(l.shiftId).name : l.shiftId), paid: l.paid || 0 };
    });
    var valid = {};
    S.teams.pool.forEach(function (p) { valid[p.id] = true; });
    S.teams.teams.forEach(function (t) { t.members = (t.members || []).filter(function (m) { return valid[+m]; }).map(Number); });
  };
  S.getFilteredPool = function () {
    var f = S.teams.filters;
    return S.teams.pool.filter(function (p) {
      if (f.role && f.role !== "ALL" && p.role !== f.role) return false;
      if (f.start && p.start !== f.start) return false;
      if (f.rdo !== "" && f.rdo != null) { var day = String(f.rdo); var days = (p.rdo || "").split(",").filter(Boolean); if (days.indexOf(day) === -1) return false; }
      return true;
    });
  };
  S.getTeamById = function (id) { for (var i = 0; i < S.teams.teams.length; i++) { if (S.teams.teams[i].id === id) return S.teams.teams[i]; } return null; };
  S.padTeamNum = function (n, width) { var w = width || 2; var s = String(n); while (s.length < w) s = "0" + s; return s; };
  S.createTeam = function (name) {
    var n = teamSeq++;
    var width = Math.max(2, String((S.teams.teams || []).length + 1).length);
    var t = { id: "T" + n, name: name != null && name !== "" ? String(name) : S.padTeamNum(n, width), members: [], followMe: false, phase: null };
    S.teams.teams.push(t);
    return t;
  };
  
  S.teamPhaseInfo = function (team) {
    var best = 24 * 60; var phase = "AM";
    var anchors = S.computeShiftAnchors ? S.computeShiftAnchors() : { am: 8 * 60, pm: 14 * 60 };
    var thr = (S.state.functionCoverage && S.state.functionCoverage.phaseThresholdMin) || 15;
    (team.members || []).forEach(function (mid) {
      var p = S.memberLine(mid); if (!p) return;
      var sm = p.startMin != null ? p.startMin : 0;
      if (sm < best) {
        best = sm;
        var sh = S.getShift && p.shiftId ? S.getShift(p.shiftId) : null;
        if (!sh && p.line && p.line.shiftId) sh = S.getShift(p.line.shiftId);
        var line = null;
        for (var i = 0; i < (S.state.lines || []).length; i++) { if (String(S.state.lines[i].id) === String(p.lineId || p.id)) { line = S.state.lines[i]; break; } }
        if (line) sh = S.getShift(line.shiftId);
        if (sh && sh.phase && sh.phase !== "auto") { var map = { opening: "Opening", am: "AM", pm: "PM", closing: "Closing" }; phase = map[sh.phase] || "AM"; }
        else if (S.phaseOfStart) phase = S.phaseOfStart(sm, anchors, thr);
        else phase = sm < (anchors.pm || 14 * 60) ? "AM" : "PM";
      }
    });
    var rank = { Opening: 0, AM: 1, PM: 2, Closing: 3 };
    return { startMin: best, phase: phase, rank: rank[phase] != null ? rank[phase] : 1 };
  };
  S.renumberTeamsByStart = function () {
    S.collectTeamPool();
    S.teams.teams.sort(function (a, b) { var ia = S.teamPhaseInfo(a); var ib = S.teamPhaseInfo(b); if (ia.rank !== ib.rank) return ia.rank - ib.rank; if (ia.startMin !== ib.startMin) return ia.startMin - ib.startMin; return String(a.id).localeCompare(String(b.id)); });
    var width = Math.max(2, String(S.teams.teams.length).length);
    S.teams.teams.forEach(function (t, i) { var info = S.teamPhaseInfo(t); t.phase = info.phase; t.name = S.padTeamNum(i + 1, width); });
  };
  S.removeTeam = function (id) { S.teams.teams = S.teams.teams.filter(function (t) { return t.id !== id; }); S.renderTeams(); };
  S.renameTeam = function (id, name) { var t = S.getTeamById(id); if (t) t.name = name; };
  S.addMemberToTeam = function (teamId, poolId) {
    var team = S.getTeamById(teamId); if (!team) return false; poolId = +poolId;
    if (team.members.indexOf(poolId) !== -1) return false;
    S.teams.teams.forEach(function (t) { if (t.id !== teamId) t.members = t.members.filter(function (m) { return m !== poolId; }); });
    team.members.push(poolId); return true;
  };
  S.removeMemberFromTeam = function (teamId, poolId) { var team = S.getTeamById(teamId); if (!team) return; poolId = +poolId; team.members = team.members.filter(function (m) { return m !== poolId; }); };
  S.memberLine = function (poolId) { poolId = +poolId; for (var i = 0; i < S.teams.pool.length; i++) { if (S.teams.pool[i].id === poolId) return S.teams.pool[i]; } return null; };
  S.assignedIds = function () { var set = {}; S.teams.teams.forEach(function (t) { t.members.forEach(function (m) { set[m] = true; }); }); return set; };
  S.unassignedPool = function () { var assigned = S.assignedIds(); return S.getFilteredPool().filter(function (p) { return !assigned[p.id]; }); };
  S.groupPoolByRole = function (list) { var groups = { TSO: [], LTSO: [], STSO: [] }; list.forEach(function (p) { if (groups[p.role]) groups[p.role].push(p); else groups.TSO.push(p); }); return groups; };
  S.getSelectedIds = function () { return Object.keys(S.teams.selected).filter(function (k) { return S.teams.selected[k]; }).map(function (k) { return +k; }); };
  S.clearSelection = function () { S.teams.selected = {}; };
  
  S.teamMemberCounts = function (team) {
    var c = { STSO: { M: 0, F: 0 }, LTSO: { M: 0, F: 0 }, TSO: { M: 0, F: 0 }, total: 0 };
    (team.members || []).forEach(function (mid) { var p = S.memberLine(mid); if (!p) return; c.total++; var role = p.role === "STSO" || p.role === "LTSO" ? p.role : "TSO"; c[role][sexOf(p)]++; });
    return c;
  };
  S.teamCountsHeaderHtml = function (team) {
    var c = S.teamMemberCounts(team);
    function bit(role) { var m = c[role].M, f = c[role].F; if (!m && !f) return ""; var tot = m + f; var fPct = tot ? Math.round((100 * f) / tot) : 0; return '<span class="team-count-chip">' + role + " " + '<span class="sex-m">' + m + "M</span>/" + '<span class="sex-f">' + f + 'F</span> <span class="muted">(' + fPct + '%F)</span></span>'; }
    var allM = c.STSO.M + c.LTSO.M + c.TSO.M; var allF = c.STSO.F + c.LTSO.F + c.TSO.F; var allT = allM + allF; var overallF = allT ? Math.round((100 * allF) / allT) : 0;
    return '<span class="team-counts-header" title="Assigned by role and sex"><span class="team-count-total">' + c.total + '</span> <span class="team-count-chip">F% ' + overallF + "</span> " + bit("STSO") + bit("LTSO") + bit("TSO") + "</span>";
  };
  S.lineEmpShort = function (p) { if (p.role === "STSO" || p.role === "LTSO") return p.role; if (p.empClass === "PT") return "PT"; return "FT"; };
  S.teamBoardHtml = function (t) {
    var membersHtml = t.members.map(function (mid) { var p = S.memberLine(mid); return p ? S.lineCardHtml(p, { removable: true, teamId: t.id }) : ""; }).join("");
    return '<div class="team-board card" data-team-id="' + t.id + '"><div class="team-board-head section-title"><input type="text" class="team-name-input" value="' + String(t.name || "").replace(/"/g, "&quot;") + '" data-team-id="' + t.id + '">' + S.teamCountsHeaderHtml(t) + '<div class="team-board-actions"><label class="follow-me-label" title="Follow Me (dock this team on screen)"><input type="checkbox" data-team-follow="' + t.id + '" ' + (t.followMe ? "checked" : "") + '> Follow</label><button type="button" class="btn btn-red" data-remove-team="' + t.id + '">✕</button></div></div><div class="team-board-list" data-team-id="' + t.id + '">' + (membersHtml || '<div class="team-board-empty muted">Drag lines here</div>') + '</div></div>';
  };
  S.lineCardHtml = function (p, opts) {
    opts = opts || {}; var sexCls = sexOf(p) === "M" ? "sex-m" : "sex-f"; var checked = opts.selectable && S.teams.selected[p.id] ? " checked" : "";
    var removeBtn = opts.removable ? '<button type="button" class="btn btn-red btn-sm" data-remove-member="' + p.id + '" data-from-team="' + (opts.teamId || "") + '">✕</button>' : "";
    if (opts.compact || opts.removable) {
      var hours = (p.start || "") + "–" + (function () { var sh = S.getShift ? S.getShift(p.shiftId) : null; return sh ? sh.end : ""; })();
      var emp = p.empClass === "PT" ? "PT" : p.empClass === "FT" ? "FT" : S.lineEmpShort(p);
      if (p.role === "STSO" || p.role === "LTSO") emp = p.empClass === "PT" || p.empClass === "FT" ? p.empClass : "—";
      return '<div class="team-line team-line-compact" data-id="' + p.id + '"><span class="team-drag-handle" title="Drag">⋮⋮</span><span class="tl-role">' + p.role + '</span><span class="tl-sex ' + sexCls + '">' + (p.sex || "—") + '</span><span class="tl-hours muted" title="' + (p.shiftName || p.shiftId) + '">' + hours + '</span><span class="tl-rdo muted" title="RDO">RDO ' + (p.rdoLabel || "—") + '</span><span class="tl-emp muted">' + emp + '</span>' + removeBtn + '</div>';
    }
    var cb = opts.selectable ? '<label class="team-line-check"><input type="checkbox" data-select-line="' + p.id + '"' + checked + '></label>' : "";
    return '<div class="team-line" data-id="' + p.id + '"><span class="team-drag-handle" title="Drag to move">⋮⋮</span>' + cb + '<span class="team-line-code">' + p.lineCode + '</span><span class="badge ' + (S.shiftBadge ? S.shiftBadge(p.shiftId) : "") + '">' + (p.shiftName || p.shiftId) + '</span><span class="muted">' + p.start + '</span><span class="muted">RDO ' + p.rdoLabel + '</span><span class="' + sexCls + '">' + p.sex + '</span><span class="muted">' + p.empClass + '</span></div>';
  };
  S.renderTeamFilters = function () {
    var bar = S.$("team-filters"); if (!bar) return;
    var starts = {}; S.teams.pool.forEach(function (p) { starts[p.start] = true; });
    var startOpts = '<option value="">All starts</option>' + Object.keys(starts).sort().map(function (s) { return '<option value="' + s + '"' + (S.teams.filters.start === s ? " selected" : "") + '>' + s + '</option>'; }).join("");
    var dayNames = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var rdoOpts = '<option value="">Any RDO day</option>' + dayNames.map(function (name, i) { return '<option value="' + i + '"' + (String(S.teams.filters.rdo) === String(i) ? " selected" : "") + '>' + name + '</option>'; }).join("");
    var teamOpts = '<option value="">— Select team —</option>' + S.teams.teams.map(function (t) { return '<option value="' + t.id + '">' + (t.name || t.id) + '</option>'; }).join("");
    var selCount = S.getSelectedIds().length;
    bar.innerHTML = '<label>Role <select id="team-filter-role"><option value="ALL"' + (S.teams.filters.role === "ALL" ? " selected" : "") + '>All</option><option value="TSO"' + (S.teams.filters.role === "TSO" ? " selected" : "") + '>TSO</option><option value="LTSO"' + (S.teams.filters.role === "LTSO" ? " selected" : "") + '>LTSO</option><option value="STSO"' + (S.teams.filters.role === "STSO" ? " selected" : "") + '>STSO</option></select></label><label>Start <select id="team-filter-start">' + startOpts + '</select></label><label>RDO <select id="team-filter-rdo">' + rdoOpts + '</select></label><button type="button" class="btn" id="btn-team-clear-filters">Clear filters</button><span class="team-assign-bar"><label>Add selected to <select id="team-assign-target">' + teamOpts + '</select></label><button type="button" class="btn btn-amber" id="btn-team-assign">Add to team' + (selCount ? " (" + selCount + ")" : "") + '</button><button type="button" class="btn" id="btn-team-select-all">Select all visible</button><button type="button" class="btn" id="btn-team-clear-sel">Clear selection</button></span>';
  };
  S.renderTeamPool = function () {
    var el = S.$("team-pool"); if (!el) return;
    var groups = S.groupPoolByRole(S.unassignedPool());
    el.innerHTML = "";
    ROLES.forEach(function (role) {
      var list = groups[role];
      var column = document.createElement('div'); column.className = 'team-role-group';
      var title = document.createElement('div'); title.className = 'team-role-title'; title.innerHTML = role + ' <span class="muted">(' + list.length + ')</span>';
      var roleList = document.createElement('div'); roleList.className = 'team-role-list'; roleList.setAttribute('data-role', role);
      roleList.innerHTML = list.length > 0 ? list.map(function (p) { return S.lineCardHtml(p, { selectable: true }); }).join("") : '<p class="muted" style="text-align: center; padding: 1rem;">(empty)</p>';
      column.appendChild(title); column.appendChild(roleList); el.appendChild(column);
    });
    if (S.unassignedPool().length === 0 && S.teams.pool.length > 0) el.innerHTML = '<p class="muted" style="grid-column: 1 / -1;">No unassigned lines match the active filters.</p>';
    else if (S.teams.pool.length === 0) el.innerHTML = '<p class="muted" style="grid-column: 1 / -1;">Generate a schedule first to populate the pool.</p>';
  };
  
  S.teamBoardsHtml = function (teamsList) { if (!teamsList || !teamsList.length) return '<p class="muted" style="padding: 0 1rem 1rem;">No teams in this group.</p>'; return teamsList.map(S.teamBoardHtml).join(""); };
  function teamAnchorMeta(team) {
    var best = null, bestMin = 24 * 60;
    (team.members || []).forEach(function (mid) { var p = S.memberLine(mid); if (!p) return; var sm = p.startMin != null ? p.startMin : 24 * 60; if (sm < bestMin) { bestMin = sm; best = p; } });
    if (!best) return { rdo: "—", start: "—", shift: "—" };
    return { rdo: best.rdoLabel || "—", start: best.start || "—", shift: best.shiftName || best.shiftId || "—" };
  }
  function teamSexTotals(team) { var c = S.teamMemberCounts(team); var m = c.STSO.M + c.LTSO.M + c.TSO.M; var f = c.STSO.F + c.LTSO.F + c.TSO.F; return { m: m, f: f, t: m + f }; }
  function teamSexBarHtml(sex) { var tot = sex.t; var mPct = tot ? Math.round((100 * sex.m) / tot) : 50; var fPct = tot ? 100 - mPct : 50; return '<div class="team-sex-bar" style="display:flex;height:4px;border-radius:2px;overflow:hidden;margin-top:0.25rem;background:#2a2a2a"><span style="width:' + mPct + '%;background:#3b82f6"></span><span style="width:' + fPct + '%;background:#ec4899"></span></div>'; }
  S.teamSummaryHtml = function (t, opts) {
    opts = opts || {}; var pinned = !!t.followMe; var meta = teamAnchorMeta(t); var sex = teamSexTotals(t); var name = String(t.name || t.id).replace(/</g, "&lt;");
    return '<button type="button" class="btn team-summary-pill' + (pinned ? " is-pinned" : "") + '" data-pin-team="' + t.id + '" title="' + (pinned ? "Unpin " : "Pin ") + name + '" style="display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:0.35rem 0.45rem;min-width:0;' + (pinned ? "outline:1px solid #60a5fa;" : "") + '"><strong style="font-size:0.85rem">' + name + (opts.badge && pinned ? " · pinned" : "") + '</strong><span class="muted" style="font-size:0.72rem">RDO ' + meta.rdo + '</span><span class="muted" style="font-size:0.72rem">' + meta.shift + " · " + meta.start + '</span><span style="font-size:0.72rem"><span class="sex-m">' + sex.m + 'M</span>/<span class="sex-f">' + sex.f + 'F</span> · ' + sex.t + 'T</span>' + teamSexBarHtml(sex) + '</button>';
  };
  function ensureTeamPicklist() {
    var existing = S.$("team-picklist"); if (existing) return existing;
    var pool = S.$("team-pool"); if (!pool || !pool.parentNode) return null;
    var wrap = document.createElement("div"); wrap.id = "team-picklist"; wrap.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.75rem;";
    wrap.innerHTML = '<div class="team-pick-panel"><div class="section-title" style="margin:0 0 0.35rem;font-size:0.8rem">Opening / AM</div><div id="team-pills-am" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(8.6rem,1fr));gap:0.35rem"></div></div><div class="team-pick-panel"><div class="section-title" style="margin:0 0 0.35rem;font-size:0.8rem">PM / Closing</div><div id="team-pills-pm" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(8.6rem,1fr));gap:0.35rem"></div></div>';
    pool.parentNode.insertBefore(wrap, pool); return wrap;
  }
  S.renderTeamPills = function () {
    ensureTeamPicklist();
    var amEl = S.$("team-pills-am"); var pmEl = S.$("team-pills-pm");
    var am = [], pm = [];
    (S.teams.teams || []).forEach(function (t) { var info = S.teamPhaseInfo(t); if (info.phase === "PM" || info.phase === "Closing") pm.push(t); else am.push(t); });
    if (amEl) amEl.innerHTML = am.length ? am.map(function (t) { return S.teamSummaryHtml(t); }).join("") : '<span class="muted" style="font-size:0.75rem">No AM teams</span>';
    if (pmEl) pmEl.innerHTML = pm.length ? pm.map(function (t) { return S.teamSummaryHtml(t); }).join("") : '<span class="muted" style="font-size:0.75rem">No PM teams</span>';
  };
  function pinMemberChipHtml(p) {
    var sexCls = sexOf(p) === 'F' ? 'sex-f' : 'sex-m';
    return '<div class="team-line team-line-compact" data-id="' + p.id + '"><span class="team-drag-handle" title="Drag">⋮⋮</span><span class="tl-role">' + p.role + '</span><span class="tl-sex ' + sexCls + '">' + (p.sex || '—') + '</span></div>';
  }
  function pinnedTeamBlockHtml(t) {
    var chips = [];
    (t.members || []).forEach(function (mid) {
      var p = S.memberLine(mid);
      if (p) chips.push(pinMemberChipHtml(p));
    });
    var listBody = chips.length ? chips.join('') : '<div class="muted" style="font-size:0.72rem;padding:0.25rem 0.2rem">drop lines</div>';
    return '<div class="team-pin-block" data-pin-block="' + t.id + '" style="display:flex;flex-direction:column;gap:0.25rem;min-width:0">' +
      S.teamSummaryHtml(t, { badge: true }) +
      '<div class="team-board-list" data-team-id="' + t.id + '" style="min-height:2.4rem;padding:0.2rem;border:1px dashed #60a5fa55">' +
      listBody +
      '</div></div>';
  }
  S.renderPinnedSummaries = function () {
    var dock = S.$('team-boards-follow');
    var title = document.querySelector('#team-boards-dock .section-title');
    if (title) title.textContent = 'Pinned';
    var pinned = (S.teams.teams || []).filter(function (t) { return !!t.followMe; });
    if (!dock) return;
    dock.innerHTML = pinned.length
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(8.6rem,1fr));gap:0.35rem">' +
        pinned.map(pinnedTeamBlockHtml).join('') +
        '</div>'
      : '<p class="muted">Pin a team pill to dock a summary here.</p>';
  };
  S.toggleTeamPin = function (teamId) { var team = S.getTeamById(teamId); if (!team) return; team.followMe = !team.followMe; if (team.followMe) S.teams.buildOpen = true; S.renderTeams(); };
  S.renderTeamBoards = function () {
    S.renderPinnedSummaries();
    var amTeams = [], pmTeams = [];
    (S.teams.teams || []).forEach(function (t) { var info = S.teamPhaseInfo(t); if (info.phase === "PM" || info.phase === "Closing") pmTeams.push(t); else amTeams.push(t); });
    var amContainer = S.$("team-boards-am"); var pmContainer = S.$("team-boards-pm");
    if (amContainer) amContainer.innerHTML = S.teamBoardsHtml(amTeams);
    if (pmContainer) pmContainer.innerHTML = S.teamBoardsHtml(pmTeams);
  };
  S.isShiftAM = function (startMin) { return (startMin || 0) < 11 * 60; };
  S.computeTeamStats = function () {
    S.collectTeamPool(); var assigned = S.assignedIds(); var total = S.teams.pool.length; var assignedN = 0;
    S.teams.pool.forEach(function (p) { if (assigned[p.id]) assignedN++; });
    var teamRows = S.teams.teams.map(function (t) { return { id: t.id, name: t.name || t.id, counts: S.teamMemberCounts(t), followMe: !!t.followMe }; });
    return { total: total, assigned: assignedN, unassigned: total - assignedN, teamRows: teamRows };
  };
  S.renderTeamStats = function () {
    var body = S.$("team-stats-body"); if (!body) return; var s = S.computeTeamStats(); var pct = s.total ? Math.round((100 * s.assigned) / s.total) : 0;
    function roleBits(c) { return ["STSO", "LTSO", "TSO"].map(function (r) { var m = c[r].M, f = c[r].F; if (!m && !f) return ""; return r + ' <span class="sex-m">' + m + 'M</span>/<span class="sex-f">' + f + 'F</span>'; }).filter(Boolean).join(" · "); }
    var rows = s.teamRows.map(function (row) { var bits = roleBits(row.counts) || "—"; var c = row.counts; var allM = c.STSO.M + c.LTSO.M + c.TSO.M; var allF = c.STSO.F + c.LTSO.F + c.TSO.F; var fPct = allM + allF ? Math.round((100 * allF) / (allM + allF)) : 0; return '<div class="team-stat-team-line"><strong>' + String(row.name).replace(/</g, "&lt;") + '</strong> <span class="muted">(' + row.counts.total + " · " + fPct + '%F)</span> ' + bits + (row.followMe ? ' <span class="team-follow-badge">follow</span>' : "") + '</div>'; }).join("");
    body.innerHTML = '<div class="team-stat-summary"><div><strong>' + s.assigned + '</strong> / ' + s.total + ' assigned (' + pct + '%)</div><div class="muted">' + s.unassigned + ' still in pool</div><div class="team-stat-bar"><div class="team-stat-bar-fill" style="width:' + pct + '%"></div></div></div><div class="team-stat-teams">' + (rows || '<p class="muted">No teams yet.</p>') + '</div>';
  };
  
  S.applyFollowMe = function () {
    var teamsTabActive = document.querySelector("#tab-teams.active") !== null;
    var following = S.teams.teams.some(function (t) { return !!t.followMe; });
    var show = teamsTabActive && (following || !!S.teams.buildOpen);
    var docks = S.$("team-follow-docks");
    if (docks) { 
      if (show) { 
        docks.hidden = false; 
        docks.classList.add("is-active"); 
        document.body.classList.add("team-follow-active"); 
        S.initFloatPanels(); 
      } else { 
        docks.hidden = true; 
        docks.classList.remove("is-active"); 
        document.body.classList.remove("team-follow-active"); 
      } 
    }
  };
  S.initFloatPanels = function () {
    if (S._floatPanelsBound) return; S._floatPanelsBound = true;
    document.querySelectorAll(".team-float-panel").forEach(function (panel, idx) {
      panel.style.width = ""; panel.style.height = "";
      if (!panel.style.left && !panel.style.right) { if (idx === 0) { panel.style.right = "24rem"; panel.style.top = "7.5rem"; } else { panel.style.right = "0.75rem"; panel.style.top = "7.5rem"; } }
      var handle = panel.querySelector("[data-drag-handle]"); if (!handle) return;
      handle.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return; if (e.target && (e.target.tagName === "BUTTON" || e.target.closest("button"))) return; e.preventDefault();
        var rect = panel.getBoundingClientRect(); var ox = e.clientX - rect.left; var oy = e.clientY - rect.top;
        panel.style.width = rect.width + "px"; panel.style.height = rect.height + "px"; panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px"; panel.style.right = "auto"; panel.classList.add("is-dragging");
        function onMove(ev) { var x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - ox)); var y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - oy)); panel.style.left = x + "px"; panel.style.top = y + "px"; }
        function onUp() { panel.classList.remove("is-dragging"); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
        document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
      });
      handle.addEventListener("touchstart", function (e) {
        if (!e.touches || !e.touches.length) return; if (e.target && (e.target.tagName === "BUTTON" || e.target.closest("button"))) return;
        var touch = e.touches[0]; var rect = panel.getBoundingClientRect(); var ox = touch.clientX - rect.left; var oy = touch.clientY - rect.top;
        panel.style.width = rect.width + "px"; panel.style.height = rect.height + "px"; panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px"; panel.style.right = "auto";
        function onMove(ev) { if (!ev.touches || !ev.touches.length) return; var t = ev.touches[0]; var x = Math.max(0, Math.min(window.innerWidth - 80, t.clientX - ox)); var y = Math.max(0, Math.min(window.innerHeight - 40, t.clientY - oy)); panel.style.left = x + "px"; panel.style.top = y + "px"; }
        function onUp() { document.removeEventListener("touchmove", onMove); document.removeEventListener("touchend", onUp); }
        document.addEventListener("touchmove", onMove, { passive: true }); document.addEventListener("touchend", onUp);
      }, { passive: true });
    });
  };
  
  S.teams.formOpts = S.teams.formOpts || { startWindowMin: 30, allowOneRdo: false };
  function parseRdoDays(p) {
    if (p && Array.isArray(p.rdoDays)) return p.rdoDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    if (p && Array.isArray(p.line && p.line.rdoDays)) return p.line.rdoDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    var raw = p && p.rdo != null ? String(p.rdo) : ""; if (!raw) return [];
    return raw.split(/[/,]+/).map(function (x) { return parseInt(x, 10); }).filter(function (d) { return d >= 0 && d <= 6; });
  }
  function startMins(p) { if (p && p.startMin != null && p.startMin !== "") return +p.startMin; var m = String(p && p.start || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return null; return (+m[1]) * 60 + (+m[2]); }
  function startsClose(a, b, windowMin) { var ma = startMins(a), mb = startMins(b); if (ma == null || mb == null) return String(a.start || "") === String(b.start || ""); var diff = Math.abs(ma - mb); return Math.min(diff, 24 * 60 - diff) <= windowMin; }
  function rdoOverlap(a, b) { var da = parseRdoDays(a), db = parseRdoDays(b), set = {}, n = 0; da.forEach(function (d) { set[d] = true; }); db.forEach(function (d) { if (set[d]) n++; }); return n; }
  function rdoExact(a, b) { var ka = parseRdoDays(a).slice().sort().join(","); var kb = parseRdoDays(b).slice().sort().join(","); return ka === kb && ka !== ""; }
  function injectControls() {
    var bar = S.$("team-architecture"); if (!bar || S.$("form-start-window")) return;
    var wrap = document.createElement("span"); wrap.className = "team-form-opts"; wrap.style.cssText = "display:inline-flex;flex-wrap:wrap;gap:0.6rem;align-items:center;";
    wrap.innerHTML = '<label title="Treat nearby start times as the same crew window">Start window (min) <input type="number" id="form-start-window" min="0" max="180" step="15" value="' + S.teams.formOpts.startWindowMin + '" style="width:4rem"></label><label class="follow-me-label" title="Also place people who share at least one RDO day and fall in the start window"><input type="checkbox" id="form-allow-one-rdo"> Allow 1 matching RDO</label>';
    var hint = S.$("arch-hint"); if (hint) bar.insertBefore(wrap, hint); else bar.appendChild(wrap);
    S.$("form-start-window").addEventListener("change", function () { S.teams.formOpts.startWindowMin = Math.max(0, Math.min(180, +this.value || 0)); });
    S.$("form-allow-one-rdo").addEventListener("change", function () { S.teams.formOpts.allowOneRdo = !!this.checked; });
  }
  function teamSexScore(team, candidate) { var c = S.teamMemberCounts(team); var m = c.STSO.M + c.LTSO.M + c.TSO.M; var f = c.STSO.F + c.LTSO.F + c.TSO.F; if (sexOf(candidate) === "F") f++; else m++; return Math.abs(m - f) / Math.max(1, m + f); }
  function roleSexScore(team, role, candidate) { var c = S.teamMemberCounts(team); var m = c[role].M; var f = c[role].F; if (sexOf(candidate) === "F") f++; else m++; return Math.abs(m - f) / Math.max(1, m + f); }
  S.autoFormTeams = function () {
    S.collectTeamPool(); var pool = S.teams.pool.slice();
    if (!pool.length) { if (S.updateStatus) S.updateStatus("Generate a schedule first so there are lines to group."); return; }
    var stsoPer = Math.max(0, +(S.$("arch-stso") && S.$("arch-stso").value) || 1);
    var ltsoPer = Math.max(0, +(S.$("arch-ltso") && S.$("arch-ltso").value) || 0);
    var tsoPer = Math.max(0, +(S.$("arch-tso") && S.$("arch-tso").value) || 0);
    var windowMin = Math.max(0, +((S.$("form-start-window") && S.$("form-start-window").value) || S.teams.formOpts.startWindowMin || 0));
    var allowOne = !!(S.$("form-allow-one-rdo") && S.$("form-allow-one-rdo").checked);
    S.teams.formOpts.startWindowMin = windowMin; S.teams.formOpts.allowOneRdo = allowOne;
    var byRole = { STSO: [], LTSO: [], TSO: [] }; pool.forEach(function (p) { if (byRole[p.role]) byRole[p.role].push(p); else byRole.TSO.push(p); });
    var nTeams = byRole.STSO.length;
    if (!nTeams) { if (S.updateStatus) S.updateStatus("No STSO lines — cannot auto-form (teams = # of STSOs)."); return; }
    S.teams.teams = []; teamSeq = 1; for (var i = 0; i < nTeams; i++) S.createTeam();
    var used = {};
    byRole.STSO.sort(function (a, b) { var sa = startMins(a) != null ? startMins(a) : 0; var sb = startMins(b) != null ? startMins(b) : 0; if (sa !== sb) return sa - sb; return String(a.rdo || "").localeCompare(String(b.rdo || "")); });
    byRole.STSO.forEach(function (p, idx) { var team = S.teams.teams[idx]; if (!team) return; team.members.push(p.id); used[p.id] = true; });
    S.renumberTeamsByStart();
    S.teams.teams.forEach(function (team) {
      var anchor = S.memberLine(team.members[0]); if (!anchor) return;
      ["STSO", "LTSO", "TSO"].forEach(function (role) {
        var c = S.teamMemberCounts(team); var have = c[role].M + c[role].F; var target = role === "STSO" ? stsoPer : role === "LTSO" ? ltsoPer : tsoPer; var need = Math.max(0, target - have); if (need === 0) return;
        var candidates = byRole[role].filter(function (p) { return !used[p.id]; });
        var scored = candidates.map(function (p) { var q = 0; if (startsClose(p, anchor, windowMin)) { if (rdoExact(p, anchor)) q = 3; else if (allowOne && rdoOverlap(p, anchor) >= 1) q = 1; } return { p: p, q: q, opp: (role === "LTSO" && sexOf(p) !== sexOf(anchor)) ? 1 : 0, teamSex: teamSexScore(team, p), roleSex: roleSexScore(team, role, p) }; }).filter(function (c) { return c.q > 0; });
        scored.sort(function (a, b) { if (b.q !== a.q) return b.q - a.q; if (b.opp !== a.opp) return b.opp - a.opp; if (a.teamSex !== b.teamSex) return a.teamSex - b.teamSex; if (a.roleSex !== b.roleSex) return a.roleSex - b.roleSex; return 0; });
        scored.slice(0, need).forEach(function (item) { team.members.push(item.p.id); used[item.p.id] = true; });
      });
    });
    var assignedN = Object.keys(used).length; var leftN = pool.length - assignedN;
    S.renderTeams(); if (S.renderLines) S.renderLines();
    if (S.updateStatus) S.updateStatus("Auto-formed " + nTeams + " team(s) · window " + windowMin + " min" + (allowOne ? " · 1-RDO allowed" : "") + " · " + assignedN + " assigned · " + leftN + " in pool");
  };
  
  S.destroySortables = function () { (S.teams.sortables || []).forEach(function (s) { try { s.destroy(); } catch (e) {} }); S.teams.sortables = []; };
  S.syncTeamsFromDom = function () {
    S.teams.teams.forEach(function (t) { t.members = []; });
    document.querySelectorAll(".team-board-list[data-team-id]").forEach(function (board) {
      var team = S.getTeamById(board.getAttribute("data-team-id")); if (!team) return;
      board.querySelectorAll(".team-line[data-id]").forEach(function (node) { var pid = +node.getAttribute("data-id"); if (!isNaN(pid) && team.members.indexOf(pid) === -1) team.members.push(pid); });
    });
  };
  S.initSortables = function () {
    if (typeof Sortable === "undefined" || typeof Sortable.create !== "function") { if (S.updateStatus) S.updateStatus("Drag-and-drop unavailable (Sortable not loaded). Use checkboxes."); return; }
    S.destroySortables();
    function makeOpts(extra) {
      var opts = { group: { name: "teams", pull: true, put: true }, animation: 150, draggable: ".team-line", handle: ".team-drag-handle, .team-line", filter: "input, button, select, label, .team-line-check", preventOnFilter: false, ghostClass: "sortable-ghost", chosenClass: "sortable-chosen", dragClass: "sortable-drag", forceFallback: false, fallbackOnBody: true, swapThreshold: 0.65, onEnd: function (evt) { if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return; S.syncTeamsFromDom(); setTimeout(function () { S.renderTeams(); if (S.renderLines) S.renderLines(); if (S.updateStatus) { var n = 0; S.teams.teams.forEach(function (t) { n += t.members.length; }); S.updateStatus("Teams updated · " + n + " line(s) assigned"); } }, 0); } };
      if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) opts[k] = extra[k]; } } return opts;
    }
    document.querySelectorAll(".team-role-list").forEach(function (el) { S.teams.sortables.push(Sortable.create(el, makeOpts({ sort: false }))); });
    document.querySelectorAll(".team-board-list").forEach(function (el) { S.teams.sortables.push(Sortable.create(el, makeOpts({}))); });
  };
  S._renderingTeams = false;
  function archTarget() { var stso = Math.max(0, +(S.$("arch-stso") && S.$("arch-stso").value) || 1); var ltso = Math.max(0, +(S.$("arch-ltso") && S.$("arch-ltso").value) || 0); var tso = Math.max(0, +(S.$("arch-tso") && S.$("arch-tso").value) || 0); return { stso: stso, ltso: ltso, tso: tso, size: stso + ltso + tso }; }
  S.teamOddities = function (team) {
    var flags = []; if (!team || !S.teamMemberCounts) return flags; var c = S.teamMemberCounts(team); var arch = archTarget(); var fill = arch.size ? c.total / arch.size : 1;
    if (arch.size && fill < 0.7) flags.push({ code: "FILL", label: Math.round(fill * 100) + "% filled" });
    if (arch.ltso > 0 && (c.LTSO.M + c.LTSO.F) < 1) flags.push({ code: "NOLTSO", label: "no LTSO" });
    var m = c.STSO.M + c.LTSO.M + c.TSO.M; var f = c.STSO.F + c.LTSO.F + c.TSO.F; var tot = m + f;
    if (tot >= 3 && Math.abs(m - f) / tot >= 0.4) flags.push({ code: "SEX", label: m + "M/" + f + "F" });
    return flags;
  };
  function collectOddities() { var fill = [], noltso = [], sex = []; ((S.teams && S.teams.teams) || []).forEach(function (t) { var name = t.name || t.id; S.teamOddities(t).forEach(function (f) { if (f.code === "FILL") fill.push(name); if (f.code === "NOLTSO") noltso.push(name); if (f.code === "SEX") sex.push(name); }); }); return { fill: fill, noltso: noltso, sex: sex }; }
  function ensureBanner() { var existing = S.$("team-oddity-top"); if (existing) return existing; var bar = document.createElement("div"); bar.id = "team-oddity-top"; bar.style.cssText = "font-family:ui-monospace,Consolas,monospace;font-size:0.82rem;letter-spacing:0.06em;padding:0.4rem 1rem;border-bottom:1px solid #c47b2b55;background:#1a140c;color:#e8dcc8;pointer-events:none;"; var header = document.querySelector(".console-header"); if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling); else document.body.insertBefore(bar, document.body.firstChild); return bar; }
  S.refreshTeamOddityBanner = function () {
    var bar = ensureBanner(); var teams = (S.teams && S.teams.teams) || []; if (!teams.length) { bar.style.display = "none"; return; } bar.style.display = "block"; var o = collectOddities(); var n = o.fill.length + o.noltso.length + o.sex.length;
    if (!n) { bar.style.borderBottomColor = "#3d6b4555"; bar.style.color = "#b7c9b0"; bar.textContent = "TEAMS CHECK  OK  ·  " + teams.length + " team(s)  ·  none under 70%  ·  all have LTSO  ·  sex split ok"; return; }
    bar.style.borderBottomColor = "#c47b2b"; bar.style.color = "#e8dcc8"; var parts = []; if (o.fill.length) parts.push(o.fill.length + " under 70% (" + o.fill.join(", ") + ")"); if (o.noltso.length) parts.push(o.noltso.length + " no LTSO (" + o.noltso.join(", ") + ")"); if (o.sex.length) parts.push(o.sex.length + " sex split (" + o.sex.join(", ") + ")"); bar.textContent = "TEAMS CHECK  " + parts.join("   ·   ");
  };
  S.renderTeams = function () {
    if (S._renderingTeams) return; S._renderingTeams = true;
    try {
      S.refreshTeamOddityBanner(); S.destroySortables(); S.collectTeamPool();
      var assigned = S.assignedIds(); Object.keys(S.teams.selected).forEach(function (k) { if (assigned[+k]) delete S.teams.selected[k]; });
      S.renderTeamFilters(); S.renderTeamPills(); S.renderTeamPool(); S.applyFollowMe(); S.renderTeamBoards(); S.renderTeamStats(); S.initSortables();
      var hint = S.$("team-count-hint");
      if (hint) { var tc = S.teams.teams.length, mc = 0; S.teams.teams.forEach(function (t) { mc += (t.members || []).length; }); hint.textContent = tc ? tc + " team(s) · " + mc + " assigned · " + S.unassignedPool().length + " in pool (filtered)" : "No teams yet — click + New team"; }
      function ensureBtn(id, insertParent) { var btn = S.$(id); if (btn) return btn; if (!insertParent) return null; btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn-amber"; btn.id = id; btn.textContent = "+ New team"; btn.style.marginRight = "0.5rem"; var buildBtn = S.$("btn-team-build"); if (buildBtn) buildBtn.insertAdjacentElement('beforebegin', btn); else insertParent.insertBefore(btn, insertParent.firstChild); return btn; }
      var topToolbar = document.querySelector("#tab-teams .card .toolbar"); var b1 = ensureBtn("btn-team-new", topToolbar);
      [b1].forEach(function (btn) { if (!btn || btn.getAttribute("data-bound") === "1") return; btn.setAttribute("data-bound", "1"); btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (S.onNewTeam) { S.onNewTeam(e); return; } var t = S.createTeam(); S.renderTeams(); if (S.updateStatus) S.updateStatus("Created " + (t && t.name ? t.name : "team")); }); });
    } finally { S._renderingTeams = false; }
  };
  S.assignSelectedToTeam = function () {
    var target = S.$("team-assign-target"); if (!target || !target.value) { if (S.updateStatus) S.updateStatus("Pick a team from the dropdown first."); return; }
    var ids = S.getSelectedIds(); if (!ids.length) { if (S.updateStatus) S.updateStatus("Select one or more lines with the checkboxes."); return; }
    var n = 0; ids.forEach(function (id) { if (S.addMemberToTeam(target.value, id)) n++; }); S.clearSelection(); S.renderTeams(); if (S.renderLines) S.renderLines();
    if (S.updateStatus) { var team = S.getTeamById(target.value); S.updateStatus("Added " + n + " line(s) to " + ((team && team.name) || target.value)); }
  };
  S.selectAllVisible = function () { S.unassignedPool().forEach(function (p) { S.teams.selected[p.id] = true; }); S.renderTeams(); };
  S.closeTeamUi = function () {
    if (!S.teams) S.teams = { teams: [] }; S.teams.buildOpen = false; (S.teams.teams || []).forEach(function (t) { t.followMe = false; }); if (S.teams.selected) S.teams.selected = {};
    var md = S.$("team-detail-modal"); if (md) { md.style.display = "none"; md.classList.remove("is-open"); }
    if (S.applyFollowMe) S.applyFollowMe(); var docks = S.$("team-follow-docks"); if (docks) { docks.hidden = true; docks.classList.remove("is-active"); } document.body.classList.remove("team-follow-active"); if (S.renderTeams) S.renderTeams(); if (S.updateStatus) S.updateStatus("Team builder closed");
  };
  document.addEventListener("click", function (e) { var t = e.target; if (!t || !t.closest) return; var x = t.closest("#btn-build-close, #team-detail-close"); if (!x) return; e.preventDefault(); e.stopPropagation(); S.closeTeamUi(); }, true);
  
  S.bindTeamUI = function () {
    if (S._teamUIBound) return; S._teamUIBound = true;
    document.addEventListener("change", function (e) {
      var t = e.target; if (!t) return;
      if (t.id === 'pool-group-by-role') S.renderTeams();
      else if (t.getAttribute && t.getAttribute("data-team-follow") != null) { var team = S.getTeamById(t.getAttribute("data-team-follow")); if (team) team.followMe = !!t.checked; S.renderTeams(); }
      else if (t.id === "team-filter-role") { S.teams.filters.role = t.value; S.renderTeams(); }
      else if (t.id === "team-filter-start") { S.teams.filters.start = t.value; S.renderTeams(); }
      else if (t.id === "team-filter-rdo") { S.teams.filters.rdo = t.value; S.renderTeams(); }
      else if (t.classList.contains("team-name-input")) S.renameTeam(t.getAttribute("data-team-id"), t.value);
      else if (t.getAttribute && t.getAttribute("data-select-line") != null) { var id = +t.getAttribute("data-select-line"); if (t.checked) S.teams.selected[id] = true; else delete S.teams.selected[id]; var btn = S.$("btn-team-assign"); if (btn) { var n = S.getSelectedIds().length; btn.textContent = "Add to team" + (n ? " (" + n + ")" : ""); } }
    });
    document.addEventListener("click", function (e) {
      var t = e.target; if (!t) return; var pinBtn = t.closest ? t.closest("[data-pin-team]") : null;
      if (t.id === "btn-team-auto-form") S.autoFormTeams();
      else if (t.id === "btn-team-build") { S.teams.buildOpen = true; S.applyFollowMe(); S.renderPinnedSummaries(); S.initSortables(); if (S.updateStatus) S.updateStatus("Pinned board open"); }
      else if (pinBtn) S.toggleTeamPin(pinBtn.getAttribute("data-pin-team"));
      else if (t.id === "btn-team-new-dock") { if (S.onNewTeam) S.onNewTeam(e); else { S.createTeam(); S.renderTeams(); } }
      else if (t.id === "btn-team-clear-filters") { S.teams.filters = { role: "ALL", start: "", rdo: "" }; S.renderTeams(); }
      else if (t.id === "btn-team-assign") S.assignSelectedToTeam();
      else if (t.id === "btn-team-select-all") S.selectAllVisible();
      else if (t.id === "btn-team-clear-sel") { S.clearSelection(); S.renderTeams(); }
      else if (t.getAttribute && t.getAttribute("data-remove-team")) S.removeTeam(t.getAttribute("data-remove-team"));
      else if (t.getAttribute && t.getAttribute("data-remove-member") != null) { S.removeMemberFromTeam(t.getAttribute("data-from-team"), t.getAttribute("data-remove-member")); S.renderTeams(); if (S.renderLines) S.renderLines(); }
    });
  };
  S.initTeams = function () { injectControls(); S.bindTeamUI(); S.collectTeamPool(); S.renderTeams(); };
  var prevRenderAll = S.renderAll;
  S.renderAll = function () { if (typeof prevRenderAll === "function") prevRenderAll.apply(this, arguments); S.collectTeamPool(); if (document.querySelector("#tab-teams.active")) S.renderTeams(); };
})(window.Scheduler);

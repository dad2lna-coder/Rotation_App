/** Mod set board — same rows as Lines export, day cells are the set name */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function days() { return S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; }
  function posOf(line) {
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  }
  function teamOf(lineId) {
    if (!S.teams || !S.teams.teams) return null;
    for (var i = 0; i < S.teams.teams.length; i++) {
      var t = S.teams.teams[i], m = t.members || [];
      for (var j = 0; j < m.length; j++) if (String(m[j]) === String(lineId)) return t;
    }
    return null;
  }
  function setName(id) {
    if (id == null || !S.listModSets) return "";
    var rec = null;
    S.listModSets().forEach(function (s) { if (String(s.id) === String(id)) rec = s; });
    return rec ? rec.name : "";
  }

  S.renderModSetBoard = function () {
    var host = S.$("tab-capacity");
    if (!host) return;
    var existing = host.querySelector("#modset-board-card");
    if (existing) existing.remove();
    var names = days();
    var lines = (S.state.lines || []).slice();
    lines.sort(function (a, b) {
      var ta = teamOf(a.id), tb = teamOf(b.id);
      var na = ta ? String(ta.name || ta.id) : "zzz";
      var nb = tb ? String(tb.name || tb.id) : "zzz";
      if (na !== nb) return na.localeCompare(nb, undefined, { numeric: true });
      return String(a.lineCode || a.id).localeCompare(String(b.lineCode || b.id), undefined, { numeric: true });
    });
    var head = "<tr><th>Team</th><th>Line</th><th>Pos</th><th>Sex</th><th>Fn</th>";
    names.forEach(function (d) { head += "<th>" + d + "</th>"; });
    head += "</tr>";
    var body = lines.map(function (line) {
      var team = teamOf(line.id);
      var html = "<td>" + (team ? (team.name || team.id) : "") + "</td><td>" + (line.lineCode || line.id) +
        "</td><td>" + posOf(line) + "</td><td>" + (line.sex || "") + "</td><td>" + (line.function || "") + "</td>";
      for (var d = 0; d < 7; d++) {
        var sched = (S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[d] || "RDO";
        if (sched !== "WORK") {
          html += '<td style="background:#000;color:#fff">RDO</td>';
          continue;
        }
        var msId = team && S.modSetForTeamDay ? S.modSetForTeamDay(team.id, d) : null;
        html += "<td>" + (msId != null ? (setName(msId) || "—") : "—") + "</td>";
      }
      return "<tr>" + html + "</tr>";
    }).join("") || '<tr><td class="muted" colspan="12">Generate lines and form teams first.</td></tr>';
    var card = document.createElement("div");
    card.className = "card";
    card.id = "modset-board-card";
    card.innerHTML =
      '<div class="section-title">Mod set board</div>' +
      '<p class="muted">Same rows as the Lines export. Day cells are the mod set, not the shift window. RDO is black.</p>' +
      '<div class="lines-scroll"><table class="data-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
    host.insertBefore(card, host.firstChild);
  };

  function hook() {
    if (typeof S.renderCapacity === "function" && !S.renderCapacity._boardHooked) {
      var orig = S.renderCapacity;
      S.renderCapacity = function () {
        orig.apply(this, arguments);
        S.renderModSetBoard();
      };
      S.renderCapacity._boardHooked = true;
    }
    if (typeof S.switchTab === "function" && !S.switchTab._boardHooked) {
      var st = S.switchTab;
      S.switchTab = function (name) {
        st.apply(this, arguments);
        if (name === "capacity") S.renderModSetBoard();
      };
      S.switchTab._boardHooked = true;
    }
  }
  hook();
  document.addEventListener("DOMContentLoaded", hook);
})(window.Scheduler);

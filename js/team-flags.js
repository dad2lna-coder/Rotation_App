/** Top-of-page team oddity check. Does not rewrite team cards (keeps Sortable intact). */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function archTarget() {
    var stso = Math.max(0, +(S.$("arch-stso") && S.$("arch-stso").value) || 1);
    var ltso = Math.max(0, +(S.$("arch-ltso") && S.$("arch-ltso").value) || 0);
    var tso = Math.max(0, +(S.$("arch-tso") && S.$("arch-tso").value) || 0);
    return { stso: stso, ltso: ltso, tso: tso, size: stso + ltso + tso };
  }

  S.teamOddities = function (team) {
    var flags = [];
    if (!team || !S.teamMemberCounts) return flags;
    var c = S.teamMemberCounts(team);
    var arch = archTarget();
    var fill = arch.size ? c.total / arch.size : 1;
    if (arch.size && fill < 0.7) {
      flags.push({ code: "FILL", label: Math.round(fill * 100) + "% filled" });
    }
    if (arch.ltso > 0 && (c.LTSO.M + c.LTSO.F) < 1) {
      flags.push({ code: "NOLTSO", label: "no LTSO" });
    }
    var m = c.STSO.M + c.LTSO.M + c.TSO.M;
    var f = c.STSO.F + c.LTSO.F + c.TSO.F;
    var tot = m + f;
    if (tot >= 3 && Math.abs(m - f) / tot >= 0.4) {
      flags.push({ code: "SEX", label: m + "M/" + f + "F" });
    }
    return flags;
  };

  function collect() {
    var fill = [], noltso = [], sex = [];
    ((S.teams && S.teams.teams) || []).forEach(function (t) {
      var name = t.name || t.id;
      S.teamOddities(t).forEach(function (f) {
        if (f.code === "FILL") fill.push(name);
        if (f.code === "NOLTSO") noltso.push(name);
        if (f.code === "SEX") sex.push(name);
      });
    });
    return { fill: fill, noltso: noltso, sex: sex };
  }

  function ensureBanner() {
    var existing = document.getElementById("team-oddity-top");
    if (existing) return existing;
    var bar = document.createElement("div");
    bar.id = "team-oddity-top";
    bar.style.cssText = "font-family:ui-monospace,Consolas,monospace;font-size:0.82rem;letter-spacing:0.06em;padding:0.4rem 1rem;border-bottom:1px solid #c47b2b55;background:#1a140c;color:#e8dcc8;pointer-events:none;";
    var header = document.querySelector(".console-header");
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  S.refreshTeamOddityBanner = function () {
    var bar = ensureBanner();
    var teams = (S.teams && S.teams.teams) || [];
    if (!teams.length) {
      bar.style.display = "none";
      return;
    }
    bar.style.display = "block";
    var o = collect();
    var n = o.fill.length + o.noltso.length + o.sex.length;
    if (!n) {
      bar.style.borderBottomColor = "#3d6b4555";
      bar.style.color = "#b7c9b0";
      bar.textContent = "TEAMS CHECK  OK  ·  " + teams.length + " team(s)  ·  none under 70%  ·  all have LTSO  ·  sex split ok";
      return;
    }
    bar.style.borderBottomColor = "#c47b2b";
    bar.style.color = "#e8dcc8";
    var parts = [];
    if (o.fill.length) parts.push(o.fill.length + " under 70% (" + o.fill.join(", ") + ")");
    if (o.noltso.length) parts.push(o.noltso.length + " no LTSO (" + o.noltso.join(", ") + ")");
    if (o.sex.length) parts.push(o.sex.length + " sex split (" + o.sex.join(", ") + ")");
    bar.textContent = "TEAMS CHECK  " + parts.join("   ·   ");
  };

  function hookRenderTeams() {
    if (typeof S.renderTeams !== "function" || S.renderTeams._oddTop) return;
    var orig = S.renderTeams;
    S.renderTeams = function () {
      orig.apply(this, arguments);
      try { S.refreshTeamOddityBanner(); } catch (e) {}
    };
    S.renderTeams._oddTop = true;
  }

  function init() {
    hookRenderTeams();
    setTimeout(hookRenderTeams, 0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);

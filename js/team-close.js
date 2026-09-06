/** X closes Team Builder docks + assignment modal even if a team/line is selected. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.closeTeamUi = function () {
    if (!S.teams) S.teams = { teams: [] };
    S.teams.buildOpen = false;
    (S.teams.teams || []).forEach(function (t) { t.followMe = false; });
    if (S.teams.selected) S.teams.selected = {};
    var md = document.getElementById("team-detail-modal");
    if (md) {
      md.style.display = "none";
      md.classList.remove("is-open");
    }
    if (S.applyFollowMe) S.applyFollowMe();
    var docks = document.getElementById("team-follow-docks");
    if (docks) {
      docks.hidden = true;
      docks.classList.remove("is-active");
    }
    document.body.classList.remove("team-follow-active");
    if (S.renderTeams) S.renderTeams();
    if (S.updateStatus) S.updateStatus("Team builder closed");
  };

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var x = t.closest("#btn-build-close, #team-detail-close");
    if (!x) return;
    e.preventDefault();
    e.stopPropagation();
    S.closeTeamUi();
  }, true);
})(window.Scheduler);

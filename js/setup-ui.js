/** Setup helpers — paint default function-coverage bands; do not wipe index layout */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function val(id, fallback) {
    var el = document.getElementById(id);
    return el && el.value != null && el.value !== "" ? el.value : fallback;
  }

  function syncHoursFromAirfield() {
    var cfg = S.getAirportConfig && S.getAirportConfig();
    var open = (cfg && cfg.startTime) || "03:30";
    var close = (cfg && cfg.endTime) || "23:00";
    var o = document.getElementById("cfg-open");
    var c = document.getElementById("cfg-close");
    if (o) o.value = open;
    if (c) c.value = close;
    if (S.state) { S.state.open = open; S.state.close = close; }
  }

  function paintFunctionCoverage() {
    if (S.ensureFunctionCoverage) S.ensureFunctionCoverage();
    if (S.fillFunctionCoverageForm) {
      try { S.fillFunctionCoverageForm(); } catch (e) {}
    }
    if (S.renderFunctionBandsTable) S.renderFunctionBandsTable();
    if (S.updateFunctionCoveragePreview) S.updateFunctionCoveragePreview();
    var save = document.getElementById("btn-save-staffing");
    if (save && !save._bound) {
      save._bound = true;
      save.addEventListener("click", function () {
        if (S.exportStaffingConfig) S.exportStaffingConfig();
      });
    }
  }

  S.rebuildSetupTab = function () {
    syncHoursFromAirfield();
    paintFunctionCoverage();
  };

  S.snapshotFte = function () {
    return {
      ftM: +(val("cfg-ft-m", S.state && S.state.ftM) || 0),
      ftF: +(val("cfg-ft-f", S.state && S.state.ftF) || 0),
      ptM: +(val("cfg-pt-m", S.state && S.state.ptM) || 0),
      ptF: +(val("cfg-pt-f", S.state && S.state.ptF) || 0),
      ltsoM: +(val("cfg-ltso-m", S.state && S.state.ltsoM) || 0),
      ltsoF: +(val("cfg-ltso-f", S.state && S.state.ltsoF) || 0),
      stsoM: +(val("cfg-stso-m", S.state && S.state.stsoM) || 0),
      stsoF: +(val("cfg-stso-f", S.state && S.state.stsoF) || 0)
    };
  };

  S.applyFte = function (fte) {
    if (!fte) return;
    function put(id, v) {
      var el = document.getElementById(id);
      if (el && v != null) el.value = v;
    }
    put("cfg-ft-m", fte.ftM); put("cfg-ft-f", fte.ftF);
    put("cfg-pt-m", fte.ptM); put("cfg-pt-f", fte.ptF);
    put("cfg-ltso-m", fte.ltsoM); put("cfg-ltso-f", fte.ltsoF);
    put("cfg-stso-m", fte.stsoM); put("cfg-stso-f", fte.stsoF);
    if (!S.state) return;
    if (fte.ftM != null) S.state.ftM = +fte.ftM || 0;
    if (fte.ftF != null) S.state.ftF = +fte.ftF || 0;
    if (fte.ptM != null) S.state.ptM = +fte.ptM || 0;
    if (fte.ptF != null) S.state.ptF = +fte.ptF || 0;
    if (fte.ltsoM != null) S.state.ltsoM = +fte.ltsoM || 0;
    if (fte.ltsoF != null) S.state.ltsoF = +fte.ltsoF || 0;
    if (fte.stsoM != null) S.state.stsoM = +fte.stsoM || 0;
    if (fte.stsoF != null) S.state.stsoF = +fte.stsoF || 0;
  };

  document.addEventListener("DOMContentLoaded", function () {
    paintFunctionCoverage();
    setTimeout(paintFunctionCoverage, 400);
  });
  window.addEventListener("blade-intro-done", function () {
    paintFunctionCoverage();
    setTimeout(paintFunctionCoverage, 200);
  });
})(window.Scheduler);

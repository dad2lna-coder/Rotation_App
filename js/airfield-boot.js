/** Airfield boot + staffing export (FTE + function coverage, no lines) */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var seeded = false;
  var confirmed = false;
  var imported = false;
  var dirty = false;

  function loadSetupUi() {
    if (document.querySelector('script[src*="js/setup-ui.js"]')) return;
    var s = document.createElement("script");
    s.src = "js/setup-ui.js?v=20260905g";
    document.body.appendChild(s);
  }
  loadSetupUi();

  function defaultConfig() {
    return {
      startTime: "03:30",
      endTime: "23:00",
      volumePerHour: { STD: 150, PRE: 240, MIX: 195 },
      terminals: [{
        id: 1, name: "Terminal 1", startTime: "03:30", endTime: "23:00",
        baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
        checkpoints: [{
          id: 1, name: "Checkpoint 1", startTime: "03:30", endTime: "23:00",
          modSets: [
            { id: 1, name: "MS-1", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 2, name: "MS-2", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 3, name: "MS-3", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 4, name: "MS-4", startTime: "03:30", lanes: 2, program: "PRE" },
            { id: 5, name: "MS-5", startTime: "03:30", lanes: 2, program: "PRE" },
            { id: 6, name: "MS-6", startTime: "03:30", lanes: 2, program: "PRE" }
          ]
        }]
      }]
    };
  }

  function dest() { return S.getAirportConfig ? S.getAirportConfig() : null; }

  function snapshotFunctionCoverage() {
    if (S.readFunctionCoverageForm) { try { S.readFunctionCoverageForm(); } catch (e) {} }
    if (S.readFunctionBandsFromDom) { try { S.readFunctionBandsFromDom(); } catch (e) {} }
    var fc = S.ensureFunctionCoverage ? S.ensureFunctionCoverage() : (S.state && S.state.functionCoverage);
    if (!fc) return null;
    return {
      poolStsoDfo: fc.poolStsoDfo || 0,
      poolLtsoDfo: fc.poolLtsoDfo || 0,
      poolTsoDfo: fc.poolTsoDfo || 0,
      amPmSplit: fc.amPmSplit !== false,
      phaseThresholdMin: fc.phaseThresholdMin != null ? fc.phaseThresholdMin : 15,
      bands: (fc.bands || []).map(function (b) {
        return { start: b.start, end: b.end, stso: +b.stso || 0, ltso: +b.ltso || 0, tso: +b.tso || 0 };
      })
    };
  }

  function applyFunctionCoverage(fc) {
    if (!fc || typeof fc !== "object") return;
    if (!S.state) S.state = {};
    if (!S.state.functionCoverage) S.state.functionCoverage = {};
    var d = S.state.functionCoverage;
    if (fc.poolStsoDfo != null) d.poolStsoDfo = +fc.poolStsoDfo || 0;
    if (fc.poolLtsoDfo != null) d.poolLtsoDfo = +fc.poolLtsoDfo || 0;
    if (fc.poolTsoDfo != null) d.poolTsoDfo = +fc.poolTsoDfo || 0;
    if (fc.amPmSplit != null) d.amPmSplit = !!fc.amPmSplit;
    if (fc.phaseThresholdMin != null) d.phaseThresholdMin = +fc.phaseThresholdMin || 0;
    if (Array.isArray(fc.bands)) d.bands = fc.bands.slice();
    if (S.ensureFunctionCoverage) S.ensureFunctionCoverage();
    if (S.fillFunctionCoverageForm) S.fillFunctionCoverageForm();
    if (S.renderFunctionBandsTable) S.renderFunctionBandsTable();
    if (S.updateFunctionCoveragePreview) S.updateFunctionCoveragePreview();
  }

  function applyAirfield(cfg) {
    var d = dest();
    if (!d || !cfg) return false;
    if (cfg.startTime) d.startTime = cfg.startTime;
    if (cfg.endTime) d.endTime = cfg.endTime;
    if (cfg.volumePerHour) d.volumePerHour = cfg.volumePerHour;
    if (Array.isArray(cfg.terminals)) d.terminals = cfg.terminals;
    seeded = true;
    return true;
  }

  function applyDefaultOnce() {
    if (seeded) return;
    var d = dest();
    if (d && d.terminals && d.terminals.length) {
      var cps = (d.terminals[0] && d.terminals[0].checkpoints) || [];
      var sets = cps[0] && cps[0].modSets ? cps[0].modSets.length : 0;
      if (d.terminals.length !== 1 || cps.length !== 1 || sets !== 6) applyAirfield(defaultConfig());
      else seeded = true;
      return;
    }
    applyAirfield(defaultConfig());
  }

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function staffingPayload() {
    if (S.readFunctionBandsFromDom) { try { S.readFunctionBandsFromDom(); } catch (e) {} }
    return {
      app: "blade-staffing",
      version: 1,
      savedAt: new Date().toISOString(),
      fte: S.snapshotFte ? S.snapshotFte() : null,
      functionCoverage: snapshotFunctionCoverage()
    };
  }

  S.exportStaffingConfig = function () {
    var data = staffingPayload();
    var filename = "staffing.json";
    try { localStorage.setItem("blade.staffingJson", JSON.stringify(data)); } catch (e) {}
    downloadJson(filename, data);
    if (S.updateStatus) S.updateStatus("Downloaded staffing.json (FTE + function coverage).");
    return Promise.resolve();
  };

  S.markAirfieldDirty = function () { dirty = true; };

  function introIsUp() {
    var intro = document.getElementById("blade-intro");
    if (!intro) return false;
    if (intro.hidden || intro.getAttribute("hidden") !== null) return false;
    return true;
  }
  function setupIsActive() {
    var btn = document.querySelector('.tab-btn[data-tab="setup"]');
    if (btn && btn.classList.contains("active")) return true;
    var panel = document.getElementById("tab-setup");
    return !!(panel && panel.classList.contains("active"));
  }

  S.openAirfieldConfirm = function () {
    if (introIsUp() || !setupIsActive()) return false;
    var modal = document.getElementById("airport-config-modal");
    if (!modal) return false;
    modal.style.display = "block";
    modal.style.zIndex = "400";
    ensureButtons();
    var hint = document.getElementById("airfield-save-hint");
    if (hint) hint.textContent = (imported && !dirty) ? "Imported — Continue without saving." : "Confirm saves airfield layout only if it changed.";
    var go = document.getElementById("btn-airfield-confirm");
    if (go) go.textContent = (imported && !dirty) ? "Continue" : "Confirm airfield";
    return true;
  };

  S.confirmAirfieldConfig = function () {
    confirmed = true;
    var modal = document.getElementById("airport-config-modal");
    function close() { if (modal) modal.style.display = "none"; }
    if (imported && !dirty) {
      if (S.updateStatus) S.updateStatus("Using imported airfield. Nothing saved.");
      close();
      return Promise.resolve();
    }
    var data = {
      app: "blade-airfield",
      version: 2,
      savedAt: new Date().toISOString(),
      config: dest()
    };
    downloadJson("airfield.json", data);
    dirty = false;
    if (S.updateStatus) S.updateStatus("Saved airfield layout.");
    close();
    return Promise.resolve();
  };

  S.importAirfieldFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = JSON.parse(String(reader.result || "{}"));
        var cfg = raw.config || raw.airportConfig || raw;
        var ok = false;
        if (raw.app === "blade-staffing" || raw.fte || (raw.functionCoverage && !raw.config && !raw.terminals)) {
          if (raw.fte && S.applyFte) S.applyFte(raw.fte);
          applyFunctionCoverage(raw.functionCoverage);
          ok = true;
          if (S.updateStatus) S.updateStatus("Imported staffing (FTE + function coverage).");
        } else {
          ok = applyAirfield(cfg);
          applyFunctionCoverage(raw.functionCoverage || (cfg && cfg.functionCoverage));
          if (raw.fte && S.applyFte) S.applyFte(raw.fte);
          imported = true;
          dirty = false;
          if (S.updateStatus) S.updateStatus("Imported airfield. Continue without saving unless you edit it.");
        }
        if (!ok && raw.app !== "blade-staffing") throw new Error("not a recognized config");
        S.openAirfieldConfirm();
      } catch (err) {
        if (S.updateStatus) S.updateStatus("Import failed: " + (err && err.message ? err.message : err));
      }
    };
    reader.readAsText(file);
  };

  function ensureButtons() {
    var modal = document.getElementById("airport-config-modal");
    if (!modal) return;
    var header = modal.querySelector(".modal-header") || modal.querySelector(".modal-content");
    if (!header || modal.querySelector("#btn-airfield-import")) return;
    var wrap = document.createElement("div");
    wrap.className = "toolbar";
    wrap.style.margin = "0.5rem 0";
    wrap.innerHTML =
      '<button type="button" class="btn" id="btn-airfield-import">Import configuration</button>' +
      '<input type="file" id="file-airfield-import" accept="application/json,.json" style="display:none" />' +
      '<button type="button" class="btn btn-amber" id="btn-airfield-confirm">Confirm airfield</button>' +
      '<span class="muted" id="airfield-save-hint"></span>';
    header.appendChild(wrap);
    document.getElementById("btn-airfield-import").addEventListener("click", function () {
      var inp = document.getElementById("file-airfield-import");
      if (inp) { inp.value = ""; inp.click(); }
    });
    document.getElementById("file-airfield-import").addEventListener("change", function (e) {
      S.importAirfieldFile(e.target.files && e.target.files[0]);
    });
    document.getElementById("btn-airfield-confirm").addEventListener("click", function () {
      S.confirmAirfieldConfig();
    });
    modal.addEventListener("change", function () { dirty = true; });
    modal.addEventListener("input", function () { dirty = true; });
  }

  function onSetupActive() {
    applyDefaultOnce();
    if (S.rebuildSetupTab) S.rebuildSetupTab();
    ensureButtons();
    if (!confirmed) S.openAirfieldConfirm();
  }

  function hookTabs() {
    if (typeof S.switchTab === "function" && !S.switchTab._airfieldHooked) {
      var orig = S.switchTab;
      S.switchTab = function (name) {
        var result = orig.apply(this, arguments);
        if (name === "setup") onSetupActive();
        return result;
      };
      S.switchTab._airfieldHooked = true;
    }
    document.querySelectorAll('.tab-btn[data-tab="setup"]').forEach(function (btn) {
      if (btn._airfieldHooked) return;
      btn._airfieldHooked = true;
      btn.addEventListener("click", function () { setTimeout(onSetupActive, 0); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyDefaultOnce();
    hookTabs();
    var modal = document.getElementById("airport-config-modal");
    if (modal && introIsUp()) modal.style.display = "none";
  });
  window.addEventListener("blade-intro-done", function () {
    hookTabs();
    if (setupIsActive()) onSetupActive();
  });
})(window.Scheduler);

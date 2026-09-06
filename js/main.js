/** Entry point — classic scripts, works from file:// and OneDrive */
window.Scheduler = window.Scheduler || {};

(function (S) {
  "use strict";

  function safeInit(name, fn) {
    if (typeof fn !== "function") return;
    try {
      fn();
    } catch (err) {
      console.error("Init failed:", name, err);
      if (S.updateStatus) S.updateStatus("Init warning: " + name + " failed.");
    }
  }

  function init() {
    if (S.$("cfg-start") && !S.$("cfg-start").value) {
      var d = S.parseStartDate(null);
      S.$("cfg-start").value = S.toDateInputValue(d);
      S.state.startDate = d;
    }

    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.switchTab(btn.dataset.tab);
      });
    });

    const instructionsModal = S.$('instructions-modal');
    const instructionsBtn = S.$('btn-instructions');
    const instructionsCloseBtn = S.$('instructions-modal-close');
    const instructionsContent = S.$('instructions-content');

    if (instructionsBtn && instructionsModal && instructionsCloseBtn && instructionsContent) {
      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, "&")
          .replace(/</g, "<")
          .replace(/>/g, ">");
      }

      function renderInstructions(text) {
        instructionsContent.innerHTML = "<pre>" + escapeHtml(text) + "</pre>";
        instructionsModal.style.display = "block";
      }

      function showInstructions() {
        if (S.INSTRUCTIONS_MD) {
          renderInstructions(S.INSTRUCTIONS_MD);
          return;
        }
        if (typeof fetch !== "function" || location.protocol === "file:") {
          renderInstructions(
            "Instructions file is missing from this copy of the app.\n" +
              "Keep js/instructions.js next to the other scripts."
          );
          return;
        }
        fetch("INSTRUCTIONS.md")
          .then(function (response) {
            if (!response.ok) throw new Error("Could not load INSTRUCTIONS.md");
            return response.text();
          })
          .then(renderInstructions)
          .catch(function (error) {
            console.error("Error fetching instructions:", error);
            instructionsContent.innerHTML =
              '<p style="color: red;">Could not load instructions from this folder. ' +
              "Use the bundled js/instructions.js or open via a local server.</p>";
            instructionsModal.style.display = "block";
          });
      }

      const hideInstructions = () => {
        instructionsModal.style.display = 'none';
      };

      instructionsBtn.addEventListener('click', showInstructions);
      instructionsCloseBtn.addEventListener('click', hideInstructions);

      window.addEventListener('click', (event) => {
        if (event.target === instructionsModal) {
          hideInstructions();
        }
      });
    }

    if (S.$("btn-generate")) S.$("btn-generate").addEventListener("click", S.generate);
    if (S.$("btn-export")) S.$("btn-export").addEventListener("click", S.exportJson);

    if (S.$("btn-import")) {
      S.$("btn-import").addEventListener("click", function () {
        var fileInput = S.$("file-import");
        if (fileInput) {
          fileInput.value = "";
          fileInput.click();
        }
      });
    }

    if (S.$("file-import")) {
      S.$("file-import").addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        S.importJsonFile(file);
      });
    }

    if (S.$("btn-clear")) S.$("btn-clear").addEventListener("click", S.clearAll);

    if (S.$("btn-clear-certs")) {
      S.$("btn-clear-certs").addEventListener("click", function () {
        if (S.clearLineFunctions) S.clearLineFunctions();
        if (S.renderLines) S.renderLines();
        if (S.updateStatus) S.updateStatus("Cleared all line functions.");
        var hint = S.$("cert-assign-hint");
        if (hint) hint.textContent = "Functions cleared.";
      });
    }

    if (S.$("btn-export-lines-excel")) {
      S.$("btn-export-lines-excel").addEventListener("click", function () {
        if (S.exportLinesExcel) S.exportLinesExcel();
      });
    }

    if (S.$("btn-add-shift")) {
      S.$("btn-add-shift").addEventListener("click", function () {
        S.readShiftsFromDom();
        var id = "S" + S.shiftSeq++;
        S.state.shifts.push({
          id: id,
          name: "Shift",
          start: "08:00",
          end: "16:30",
          paid: 8,
          force: 0,
          ltsoForce: 0,
          stsoForce: 0,
          rdoHard: []
        });
        S.renderShiftsTable();
      });
    }

    safeInit("airport", S.initAirportConfig);
    safeInit("shifts", S.renderShiftsTable);
    safeInit("teams", S.initTeams);
    safeInit("shiftDayTimes", S.initShiftDayTimes);
    safeInit("functionCoverage", S.initFunctionCoverage);
    safeInit("reports", S.initReports);
    safeInit("linesUI", S.bindLinesUI);
    safeInit("capacity", S.initCapacity);

    function onNewTeam(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!S.createTeam) return;
      var t = S.createTeam();
      if (S.renderTeams) S.renderTeams();
      if (S.updateStatus) S.updateStatus("Created " + (t && t.name ? t.name : "team"));
    }
    S.onNewTeam = onNewTeam;

    ["btn-team-new", "btn-team-new-2"].forEach(function (id) {
      var btn = S.$(id);
      if (btn) btn.addEventListener("click", onNewTeam);
    });

    S.updateStatus("BLADE Alpha Build — boot 20260904f");
    if (S.renderAll) S.renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);

})(window.Scheduler);

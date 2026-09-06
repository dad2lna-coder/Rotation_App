/** Airport configuration modal — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var airportConfig = { startTime: "03:30", endTime: "23:00", volumePerHour: { STD: 150, PRE: 240, MIX: 195 }, terminals: [] };
  var nextTerminalId = 1, nextCheckpointId = 1, nextModSetId = 1;
  var activeDetailView = null;

  S.initAirportConfig = function () {
    var modal = S.$("airport-config-modal");
    var openBtn = S.$("btn-airport-config");
    var closeBtn = S.$("modal-close-btn");
    if (openBtn) openBtn.addEventListener("click", function () {
      if (modal) modal.style.display = "block";
      renderAirportConfig();
    });
    if (closeBtn) closeBtn.addEventListener("click", function () {
      if (modal) modal.style.display = "none";
    });
    window.addEventListener("click", function (event) {
      if (event.target == modal) modal.style.display = "none";
    });
    if (S.$("airport-start-time")) {
      S.$("airport-start-time").addEventListener("change", function (e) {
        airportConfig.startTime = e.target.value;
      });
    }
    if (S.$("airport-end-time")) {
      S.$("airport-end-time").addEventListener("change", function (e) {
        airportConfig.endTime = e.target.value;
      });
    }
    if (S.$("add-terminal-btn")) {
      S.$("add-terminal-btn").addEventListener("click", function () {
        airportConfig.terminals.push({
          id: nextTerminalId++,
          name: "Terminal " + (nextTerminalId - 1),
          startTime: airportConfig.startTime,
          endTime: airportConfig.endTime,
          baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
          checkpoints: []
        });
        renderAirportConfig();
      });
    }
    seedBaselineAirport();
    renderAirportConfig();
  };

  function seedBaselineAirport() {
    if (airportConfig.terminals && airportConfig.terminals.length) return;
    airportConfig.terminals = [{
      id: 1,
      name: "Terminal A",
      startTime: "03:30",
      endTime: "23:00",
      baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
      checkpoints: [
        {
          id: 1,
          name: "A Main",
          startTime: "03:30",
          endTime: "23:00",
          modSets: [
            { id: 1, startTime: "03:30", lanes: 2, program: "STD" },
            { id: 2, startTime: "05:00", lanes: 2, program: "MIX" }
          ]
        },
        {
          id: 2,
          name: "A PreCheck",
          startTime: "04:00",
          endTime: "21:00",
          modSets: [{ id: 3, startTime: "04:00", lanes: 2, program: "PRE" }]
        }
      ]
    }];
    nextTerminalId = 2;
    nextCheckpointId = 3;
    nextModSetId = 4;
  }

  function renderAirportConfig() {
    if (S.$("airport-start-time")) S.$("airport-start-time").value = airportConfig.startTime;
    if (S.$("airport-end-time")) S.$("airport-end-time").value = airportConfig.endTime;
    var list = S.$("terminals-list");
    if (!list) return;
    list.innerHTML = airportConfig.terminals.map(renderTerminalRow).join("");
    attachTerminalEventListeners();
    airportConfig.terminals.forEach(function (t) {
      if (t.checkpoints && t.checkpoints.length > 0) {
        var row = list.querySelector('[data-terminal-id="' + t.id + '"]');
        if (row) attachCheckpointEventListeners(t.id, row.nextElementSibling);
      }
    });
    if (activeDetailView) renderDetailView();
    else if (S.$("detail-view")) S.$("detail-view").style.display = "none";
  }

  function attachTerminalEventListeners() {
    document.querySelectorAll("#terminals-list .delete-terminal-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var id = parseInt(e.target.dataset.id);
        airportConfig.terminals = airportConfig.terminals.filter(function (t) { return t.id !== id; });
        if (activeDetailView && activeDetailView.type === "terminal" && activeDetailView.id === id)
          activeDetailView = null;
        renderAirportConfig();
      });
    });
    document.querySelectorAll("#terminals-list .edit-terminal-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        activeDetailView = { type: "terminal", id: parseInt(e.target.dataset.id) };
        renderDetailView();
      });
    });
    document.querySelectorAll("#terminals-list .add-checkpoint-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var tid = parseInt(e.target.dataset.id);
        var terminal = airportConfig.terminals.find(function (t) { return t.id === tid; });
        if (terminal) {
          terminal.checkpoints.push({
            id: nextCheckpointId++,
            name: "Checkpoint " + (nextCheckpointId - 1),
            startTime: terminal.startTime,
            endTime: terminal.endTime,
            modSets: [{ id: nextModSetId++, startTime: terminal.startTime, lanes: 2, program: "STD" }]
          });
          renderAirportConfig();
        }
      });
    });
    document.querySelectorAll("#terminals-list .terminal-name-input").forEach(function (input) {
      input.addEventListener("change", function (e) {
        var terminal = airportConfig.terminals.find(function (t) {
          return t.id === parseInt(e.target.dataset.id);
        });
        if (terminal) terminal.name = e.target.value;
      });
    });
  }

  function attachCheckpointEventListeners(terminalId, scope) {
    var terminal = airportConfig.terminals.find(function (t) { return t.id === terminalId; });
    if (!terminal || !scope) return;
    scope.querySelectorAll(".delete-checkpoint-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var cid = parseInt(e.target.dataset.id);
        terminal.checkpoints = terminal.checkpoints.filter(function (c) { return c.id !== cid; });
        if (activeDetailView && activeDetailView.type === "checkpoint" && activeDetailView.id === cid)
          activeDetailView = { type: "terminal", id: terminalId };
        renderAirportConfig();
      });
    });
    scope.querySelectorAll(".edit-checkpoint-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        activeDetailView = {
          type: "checkpoint",
          id: parseInt(e.target.dataset.id),
          parentId: terminalId
        };
        renderDetailView();
      });
    });
    scope.querySelectorAll(".checkpoint-name-input").forEach(function (input) {
      input.addEventListener("change", function (e) {
        var cp = terminal.checkpoints.find(function (c) {
          return c.id === parseInt(e.target.dataset.id);
        });
        if (cp) cp.name = e.target.value;
      });
    });
  }

  function renderTerminalRow(terminal) {
    var cps = (terminal.checkpoints || []).map(renderCheckpointRow).join("");
    return (
      '<div class="item-row" data-terminal-id="' + terminal.id + '">' +
      '<div class="item-name"><input type="text" class="terminal-name-input" data-id="' + terminal.id +
      '" value="' + terminal.name + '"></div>' +
      '<button class="btn edit-terminal-btn" data-id="' + terminal.id + '">Configure</button>' +
      '<button class="btn add-checkpoint-btn" data-id="' + terminal.id + '">+ Add Checkpoint</button>' +
      '<button class="btn btn-red delete-terminal-btn" data-id="' + terminal.id + '">Delete</button>' +
      "</div>" +
      '<div class="sub-item" data-sub-item-for="' + terminal.id + '">' +
      (cps || '<p class="muted">No checkpoints assigned.</p>') +
      "</div>"
    );
  }

  function renderCheckpointRow(checkpoint) {
    return (
      '<div class="item-row" data-checkpoint-id="' + checkpoint.id + '">' +
      '<div class="item-name"><input type="text" class="checkpoint-name-input" data-id="' + checkpoint.id +
      '" value="' + checkpoint.name + '"></div>' +
      '<button class="btn edit-checkpoint-btn" data-id="' + checkpoint.id + '">Configure</button>' +
      '<button class="btn btn-red delete-checkpoint-btn" data-id="' + checkpoint.id + '">Delete</button>' +
      "</div>"
    );
  }

  function renderDetailView() {
    var detailView = S.$("detail-view");
    if (!detailView) return;
    detailView.style.display = "block";
    var tabs = S.$("detail-tabs");
    var panels = S.$("detail-panels");
    if (!activeDetailView) {
      detailView.style.display = "none";
      return;
    }
    if (activeDetailView.type === "terminal") {
      var terminal = airportConfig.terminals.find(function (t) {
        return t.id === activeDetailView.id;
      });
      if (!terminal) {
        activeDetailView = null;
        renderAirportConfig();
        return;
      }
      tabs.innerHTML = '<button class="modal-tab-btn active">Terminal: ' + terminal.name + "</button>";
      panels.innerHTML = renderTerminalDetailPanel(terminal);
      attachTerminalDetailEventListeners(terminal);
    } else if (activeDetailView.type === "checkpoint") {
      var terminalId = activeDetailView.parentId;
      var terminal = airportConfig.terminals.find(function (t) { return t.id === terminalId; });
      var checkpoint = terminal && terminal.checkpoints.find(function (c) {
        return c.id === activeDetailView.id;
      });
      if (!checkpoint) {
        activeDetailView = { type: "terminal", id: terminalId };
        renderDetailView();
        return;
      }
      tabs.innerHTML =
        '<button class="modal-tab-btn" data-type="terminal" data-id="' + terminalId +
        '">Terminal: ' + terminal.name + "</button>" +
        '<button class="modal-tab-btn active">Checkpoint: ' + checkpoint.name + "</button>";
      panels.innerHTML = renderCheckpointDetailPanel(checkpoint);
      var tab = tabs.querySelector('.modal-tab-btn[data-type="terminal"]');
      if (tab) {
        tab.addEventListener("click", function (e) {
          activeDetailView = { type: "terminal", id: parseInt(e.target.dataset.id) };
          renderDetailView();
        });
      }
      attachCheckpointDetailEventListeners(checkpoint);
    }
  }

  function renderTerminalDetailPanel(terminal) {
    var cost = terminal.baseTSOCost || { STD: 6, PRE: 5, MIX: 6 };
    return (
      '<div class="modal-panel active"><div class="config-section">' +
      '<h4 class="config-section-title">Terminal Settings</h4><div class="grid-2">' +
      '<label>Terminal Start Time <input type="time" class="terminal-start-time" data-id="' +
      terminal.id + '" value="' + terminal.startTime + '" step="900"></label>' +
      '<label>Terminal End Time <input type="time" class="terminal-end-time" data-id="' +
      terminal.id + '" value="' + terminal.endTime + '" step="900"></label></div></div>' +
      '<div class="config-section"><h4 class="config-section-title">Base TSO Cost per Lane</h4>' +
      '<div class="grid-3">' +
      '<label>STD Program <input type="number" class="tso-cost-std" data-id="' +
      terminal.id + '" value="' + cost.STD + '"></label>' +
      '<label>PRE Program <input type="number" class="tso-cost-pre" data-id="' +
      terminal.id + '" value="' + cost.PRE + '"></label>' +
      '<label>MIX Program <input type="number" class="tso-cost-mix" data-id="' +
      terminal.id + '" value="' + cost.MIX + '"></label></div></div></div>'
    );
  }

  function renderCheckpointDetailPanel(checkpoint) {
    var modSetsHTML = (checkpoint.modSets || []).map(renderModSetRow).join("");
    return (
      '<div class="modal-panel active"><div class="config-section">' +
      '<h4 class="config-section-title">Checkpoint Settings</h4><div class="grid-2">' +
      '<label>Checkpoint Start Time <input type="time" class="checkpoint-start-time" data-id="' +
      checkpoint.id + '" value="' + checkpoint.startTime + '" step="900"></label>' +
      '<label>Checkpoint End Time <input type="time" class="checkpoint-end-time" data-id="' +
      checkpoint.id + '" value="' + checkpoint.endTime + '" step="900"></label></div></div>' +
      '<div class="config-section"><h4 class="config-section-title">Mod Sets ' +
      '<button class="btn add-modset-btn" data-id="' + checkpoint.id + '">+ Add Mod Set</button></h4>' +
      '<div class="item-list">' +
      (modSetsHTML || '<p class="muted">No mod sets assigned.</p>') +
      "</div></div></div>"
    );
  }

  function renderModSetRow(modSet) {
    return (
      '<div class="item-row" data-modset-id="' + modSet.id + '"><div class="grid-4">' +
      '<label>Start Time <input type="time" class="modset-start-time" data-id="' +
      modSet.id + '" value="' + modSet.startTime + '" step="900"></label>' +
      '<label>Lanes <input type="number" class="modset-lanes" data-id="' +
      modSet.id + '" min="1" value="' + modSet.lanes + '"></label>' +
      '<label>Program <select class="modset-program" data-id="' + modSet.id + '">' +
      '<option value="STD"' + (modSet.program === "STD" ? " selected" : "") + ">STD</option>" +
      '<option value="PRE"' + (modSet.program === "PRE" ? " selected" : "") + ">PRE</option>" +
      '<option value="MIX"' + (modSet.program === "MIX" ? " selected" : "") + ">MIX</option>" +
      '</select></label>' +
      '<button class="btn btn-red delete-modset-btn" data-id="' + modSet.id + '">Delete</button>' +
      "</div></div>"
    );
  }

  function attachTerminalDetailEventListeners(terminal) {
    var el;
    el = document.querySelector(".terminal-start-time");
    if (el) el.addEventListener("change", function (e) { terminal.startTime = e.target.value; });
    el = document.querySelector(".terminal-end-time");
    if (el) el.addEventListener("change", function (e) { terminal.endTime = e.target.value; });
    if (!terminal.baseTSOCost) terminal.baseTSOCost = { STD: 6, PRE: 5, MIX: 6 };
    el = document.querySelector(".tso-cost-std");
    if (el) el.addEventListener("change", function (e) {
      terminal.baseTSOCost.STD = parseFloat(e.target.value) || 0;
    });
    el = document.querySelector(".tso-cost-pre");
    if (el) el.addEventListener("change", function (e) {
      terminal.baseTSOCost.PRE = parseFloat(e.target.value) || 0;
    });
    el = document.querySelector(".tso-cost-mix");
    if (el) el.addEventListener("change", function (e) {
      terminal.baseTSOCost.MIX = parseFloat(e.target.value) || 0;
    });
  }

  function attachCheckpointDetailEventListeners(checkpoint) {
    var el;
    el = document.querySelector(".checkpoint-start-time");
    if (el) el.addEventListener("change", function (e) { checkpoint.startTime = e.target.value; });
    el = document.querySelector(".checkpoint-end-time");
    if (el) el.addEventListener("change", function (e) { checkpoint.endTime = e.target.value; });
    el = document.querySelector(".add-modset-btn");
    if (el) el.addEventListener("click", function () {
      checkpoint.modSets.push({
        id: nextModSetId++,
        startTime: checkpoint.startTime,
        lanes: 2,
        program: "STD"
      });
      renderDetailView();
    });
    document.querySelectorAll(".delete-modset-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var mid = parseInt(e.target.dataset.id);
        checkpoint.modSets = checkpoint.modSets.filter(function (ms) { return ms.id !== mid; });
        renderDetailView();
      });
    });
    document.querySelectorAll(".modset-start-time").forEach(function (input) {
      input.addEventListener("change", function (e) {
        var ms = checkpoint.modSets.find(function (m) {
          return m.id === parseInt(e.target.dataset.id);
        });
        if (ms) ms.startTime = e.target.value;
      });
    });
    document.querySelectorAll(".modset-lanes").forEach(function (input) {
      input.addEventListener("change", function (e) {
        var ms = checkpoint.modSets.find(function (m) {
          return m.id === parseInt(e.target.dataset.id);
        });
        if (ms) ms.lanes = parseInt(e.target.value) || 1;
      });
    });
    document.querySelectorAll(".modset-program").forEach(function (select) {
      select.addEventListener("change", function (e) {
        var ms = checkpoint.modSets.find(function (m) {
          return m.id === parseInt(e.target.dataset.id);
        });
        if (ms) ms.program = e.target.value;
      });
    });
  }

  S.getAirportConfig = function () { return airportConfig; };
})(window.Scheduler);

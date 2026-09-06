/** Airport, operator, export names, optional shared-folder I/O */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var LS_AIRPORT = "blade.airportCode";
  var LS_OPERATOR = "blade.operator";
  var LS_FOLDER = "blade.sharedFolderHint";

  S.AIRPORTS = [
    { code: "DAL", name: "Dallas Love Field" },
    { code: "DFW", name: "Dallas/Fort Worth" },
    { code: "AUS", name: "Austin-Bergstrom" },
    { code: "IAH", name: "Houston Intercontinental" },
    { code: "HOU", name: "Houston Hobby" },
    { code: "SAT", name: "San Antonio" },
    { code: "ELP", name: "El Paso" },
    { code: "OKC", name: "Will Rogers" },
    { code: "TUL", name: "Tulsa" },
    { code: "LIT", name: "Little Rock" }
  ];

  S.getAirportCode = function () {
    var st = (S.state && S.state.airportCode) || localStorage.getItem(LS_AIRPORT) || "DAL";
    return String(st).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "DAL";
  };

  S.setAirportCode = function (code) {
    var c = String(code || "DAL").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "DAL";
    if (!S.state) S.state = {};
    S.state.airportCode = c;
    try { localStorage.setItem(LS_AIRPORT, c); } catch (e) {}
    if (S.refreshConsoleChrome) S.refreshConsoleChrome();
    return c;
  };

  S.getOperator = function () {
    return (S.state && S.state.operator) || localStorage.getItem(LS_OPERATOR) || "OPERATOR";
  };

  S.setOperator = function (name) {
    var n = String(name || "OPERATOR").trim() || "OPERATOR";
    if (!S.state) S.state = {};
    S.state.operator = n;
    try { localStorage.setItem(LS_OPERATOR, n); } catch (e) {}
    var el = document.getElementById("console-operator");
    if (el) el.textContent = n;
    return n;
  };

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  S.exportDateStamp = function (d) {
    d = d || new Date();
    return pad(d.getMonth() + 1) + pad(d.getDate()) + d.getFullYear();
  };

  S.exportFileName = function (kind, ext) {
    var code = S.getAirportCode();
    var stamp = S.exportDateStamp();
    var k = kind || "Config";
    return code + "_" + k + "_" + stamp + (ext || ".json");
  };

  function tauriInvoke(cmd, args) {
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (!core || typeof core.invoke !== "function") return Promise.reject(new Error("no-tauri"));
    return core.invoke(cmd, args || {});
  }

  S.isTauri = function () {
    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  };

  S.detectOperator = function () {
    if (S.isTauri()) {
      return tauriInvoke("get_operator").then(function (name) {
        return S.setOperator(name);
      }).catch(function () {
        return S.getOperator();
      });
    }
    return Promise.resolve(S.getOperator());
  };

  S.sharedFolderHint = function () {
    return localStorage.getItem(LS_FOLDER) || "";
  };

  S.setSharedFolderHint = function (path) {
    try { localStorage.setItem(LS_FOLDER, path || ""); } catch (e) {}
  };

  var dirHandle = null;

  S.pickSharedFolder = async function () {
    if (!window.showDirectoryPicker) {
      if (S.updateStatus) {
        S.updateStatus("Folder picker needs Chrome/Edge, or the Tauri desktop build.");
      }
      return null;
    }
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    S.setSharedFolderHint(dirHandle.name || "shared-folder");
    if (S.updateStatus) S.updateStatus("Shared folder linked: " + dirHandle.name);
    return dirHandle;
  };

  async function writeWithHandle(filename, blob) {
    if (!dirHandle) return false;
    var file = await dirHandle.getFileHandle(filename, { create: true });
    var w = await file.createWritable();
    await w.write(blob);
    await w.close();
    return true;
  }

  S.saveBlob = async function (blob, filename) {
    if (S.isTauri()) {
      var hint = S.sharedFolderHint();
      if (hint) {
        var buf = await blob.arrayBuffer();
        var bytes = Array.from(new Uint8Array(buf));
        try {
          await tauriInvoke("write_shared_bytes", {
            folder: hint,
            filename: filename,
            bytes: bytes
          });
          if (S.updateStatus) S.updateStatus("Wrote " + filename + " to shared folder.");
          return;
        } catch (err) {
          console.warn("Tauri write failed, falling back to download", err);
        }
      }
    }
    try {
      if (dirHandle && (await writeWithHandle(filename, blob))) {
        if (S.updateStatus) S.updateStatus("Wrote " + filename + " to linked folder.");
        return;
      }
    } catch (err) {
      console.warn("Folder write failed", err);
    }
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!S.state) S.state = {};
    S.state.airportCode = S.getAirportCode();
    S.detectOperator();
  });
})(window.Scheduler);

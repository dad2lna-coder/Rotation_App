(function () {
  function load(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = cb || function () {};
    document.head.appendChild(s);
  }
  function inject() {
    var bar = document.getElementById("lines-toolbar");
    if (bar && !document.getElementById("btn-export-interchange")) {
      var exp = document.createElement("button");
      exp.type = "button";
      exp.className = "btn";
      exp.id = "btn-export-interchange";
      exp.textContent = "Export Debug / Interchange Workbook";
      var imp = document.createElement("button");
      imp.type = "button";
      imp.className = "btn";
      imp.id = "btn-import-interchange";
      imp.textContent = "Import Debug / Interchange Workbook";
      var file = document.createElement("input");
      file.type = "file";
      file.id = "fInterchange";
      file.accept = ".xlsx,.xls";
      file.hidden = true;
      bar.appendChild(exp);
      bar.appendChild(imp);
      bar.appendChild(file);
    }
    if (window.BladeInterchange && BladeInterchange.hookUi) BladeInterchange.hookUi();
  }
  function sanitizeRosterPo() {
    var R = window.S;
    if (!R || !Array.isArray(R.roster)) return;
    R.roster.forEach(function (r) {
      var src = r.position || (r.ti ? String(r.ti).split("/")[0] : "") || "";
      if (r.po === "TDC" && src && src !== "TDC") r.po = src;
      if (r.po === "BAG" && r.duty !== "BAG" && r.functionName !== "BAG") r.po = src || r.po;
      if (r.po === "DFO" && r.duty !== "DFO" && r.functionName !== "DFO") r.po = src || r.po;
      if (!r.position && src) r.position = src;
    });
  }
  var prev = window.pushLinesToRotation;
  window.pushLinesToRotation = function () {
    if (typeof prev === "function") prev();
    sanitizeRosterPo();
  };
  function boot() {
    inject();
    if (!window.BladeInterchange) load("js/blade-interchange.js", inject);
    setTimeout(sanitizeRosterPo, 600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

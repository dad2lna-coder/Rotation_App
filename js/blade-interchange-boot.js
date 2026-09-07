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
  function boot() {
    inject();
    if (!window.BladeInterchange) load("js/blade-interchange.js", inject);
    load("js/interchange-day-import.js");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

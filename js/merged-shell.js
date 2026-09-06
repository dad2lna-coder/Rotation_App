(function () {
  function $(id) { return document.getElementById(id); }
  var S = window.Scheduler = window.Scheduler || {};
  function applyRotTheme(name) {
    try { localStorage.setItem("rotation.theme", name); } catch (e) {}
    document.querySelectorAll("#rot-theme-seg [data-theme]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme") === name);
    });
    if (typeof setTheme === "function") setTheme(name, true);
  }
  var orig = S.switchTab;
  S.switchTab = function (name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    document.querySelectorAll("main > .panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
    if (typeof orig === "function" && name !== "rotation") {
      try { orig.call(S, name); } catch (e) {}
    }
    if ((name === "rotation" || name === "capacity") && S.renderPlacementMatrix) {
      S.renderPlacementMatrix();
    }
  };
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { S.switchTab(btn.getAttribute("data-tab")); });
  });
  var seg = $("rot-theme-seg");
  if (seg) {
    seg.addEventListener("click", function (e) {
      var t = e.target && e.target.getAttribute && e.target.getAttribute("data-theme");
      if (t) applyRotTheme(t);
    });
  }
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    var map = { F1: "setup", F2: "coverage", F3: "lines", F4: "teams", F5: "reports", F6: "capacity", F7: "rotation" };
    if (map[e.key]) { e.preventDefault(); S.switchTab(map[e.key]); }
  });
  applyRotTheme(localStorage.getItem("rotation.theme") || "dark");
  function loadScript(src, then) {
    if (document.querySelector('script[src*="' + src.split("/").pop() + '"]')) {
      if (then) then();
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.onload = then || function () {};
    document.body.appendChild(s);
  }
  loadScript("js/f7-placement.js", function () {
    if (S.initPlacement) S.initPlacement();
    loadScript("js/f7-staff-fallback.js");
  });
  S.switchTab("rotation");
})();

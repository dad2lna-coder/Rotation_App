(function () {
  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function tick() {
    var now = new Date();
    if ($("console-time")) $("console-time").textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    if ($("console-date")) $("console-date").textContent =
      pad(now.getMonth() + 1) + "/" + pad(now.getDate()) + "/" + now.getFullYear();
  }

  function theme() {
    return localStorage.getItem("rotation.theme") || "dark";
  }

  function applyTheme(name) {
    name = name || theme();
    try { localStorage.setItem("rotation.theme", name); } catch (e) {}
    document.querySelectorAll("#rot-theme-seg [data-theme]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme") === name);
    });
    var frame = $("rotation-frame");
    if (frame && frame.contentWindow) {
      try { frame.contentWindow.postMessage({ type: "blade-theme", theme: name }, "*"); } catch (e) {}
    }
  }

  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
  }

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-tab")); });
  });
  var seg = $("rot-theme-seg");
  if (seg) {
    seg.addEventListener("click", function (e) {
      var t = e.target && e.target.getAttribute && e.target.getAttribute("data-theme");
      if (t) applyTheme(t);
    });
  }
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "F1") { e.preventDefault(); switchTab("setup"); }
    if (e.key === "F7") { e.preventDefault(); switchTab("rotation"); }
  });
  var frame = $("rotation-frame");
  if (frame) frame.addEventListener("load", function () { applyTheme(theme()); });
  tick();
  setInterval(tick, 1000);
  applyTheme(theme());
})();

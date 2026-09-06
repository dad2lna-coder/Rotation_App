/** Rotation joins BLADE as an F7 module. Blade stays the shell. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var LS_THEME = "rotation.theme";
  var REMOTE =
    "https://dad2lna-coder.github.io/Rotation_App/original_file/RotationBuilder%201.html?embed=1";
  var LOCAL = "rotation/index.html?embed=1";

  function $(id) { return document.getElementById(id); }

  function currentTheme() {
    return localStorage.getItem(LS_THEME) || "dark";
  }

  function applyTheme(theme) {
    theme = theme || currentTheme();
    try { localStorage.setItem(LS_THEME, theme); } catch (e) {}
    document.documentElement.setAttribute("data-rot-theme", theme);
    document.querySelectorAll("#rot-theme-seg [data-theme]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme") === theme);
    });
    var frame = $("rotation-frame");
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: "blade-theme", theme: theme }, "*");
      } catch (e) {}
    }
  }

  function ensureChrome() {
    var tabs = document.querySelector("nav.tabs");
    if (tabs && !tabs.querySelector('[data-tab="rotation"]')) {
      var btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.setAttribute("data-tab", "rotation");
      btn.textContent = "[F7] ROTATION";
      tabs.appendChild(btn);
      btn.addEventListener("click", function () {
        if (S.switchTab) S.switchTab("rotation");
        else showRotation();
      });
    }

    var main = document.querySelector("main");
    if (main && !$("tab-rotation")) {
      var sec = document.createElement("section");
      sec.className = "panel";
      sec.id = "tab-rotation";
      sec.innerHTML =
        '<div class="card rotation-dock">' +
        '<div class="section-title">Rotation sheet</div>' +
        '<p class="muted">Checkpoint rotation lives inside BLADE. Load the demo roster, then generate.</p>' +
        '<iframe id="rotation-frame" title="Rotation Builder" class="rotation-frame" src="about:blank"></iframe>' +
        "</div>";
      main.appendChild(sec);
    }

    var actions = document.querySelector(".topbar-actions");
    if (actions && !$("rot-theme-seg")) {
      var wrap = document.createElement("div");
      wrap.id = "rot-theme-seg";
      wrap.className = "rot-theme-seg";
      wrap.title = "Rotation appearance";
      wrap.innerHTML =
        '<button type="button" data-theme="dark">Dark</button>' +
        '<button type="button" data-theme="light">Light</button>' +
        '<button type="button" data-theme="vivid">Vivid</button>';
      actions.appendChild(wrap);
    }
    var seg = $("rot-theme-seg");
    if (seg && !seg._bound) {
      seg.addEventListener("click", function (e) {
        var t = e.target && e.target.getAttribute && e.target.getAttribute("data-theme");
        if (t) applyTheme(t);
      });
      seg._bound = true;
    }
  }

  function loadFrame() {
    var frame = $("rotation-frame");
    if (!frame || frame.getAttribute("data-loaded")) return;
    function use(src) {
      frame.src = src;
      frame.setAttribute("data-loaded", "1");
      frame.addEventListener("load", function () { applyTheme(currentTheme()); });
    }
    fetch(LOCAL.replace("?embed=1", ""), { method: "HEAD" })
      .then(function (r) { use(r.ok ? LOCAL : REMOTE); })
      .catch(function () { use(REMOTE); });
  }

  function showRotation() {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === "rotation");
    });
    document.querySelectorAll("main .panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-rotation");
    });
    document.body.classList.add("rotation-open");
    loadFrame();
    applyTheme(currentTheme());
    if (S.updateStatus) S.updateStatus("ROTATION module");
  }

  function wrapSwitch() {
    if (typeof S.switchTab !== "function") {
      S.switchTab = function (name) {
        if (name === "rotation") return showRotation();
        document.body.classList.remove("rotation-open");
        document.querySelectorAll(".tab-btn").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-tab") === name);
        });
        document.querySelectorAll("main .panel").forEach(function (p) {
          p.classList.toggle("active", p.id === "tab-" + name);
        });
      };
      return;
    }
    if (S.switchTab._rotWrapped) return;
    var orig = S.switchTab;
    S.switchTab = function (name) {
      if (name === "rotation") {
        showRotation();
        return;
      }
      document.body.classList.remove("rotation-open");
      return orig.apply(this, arguments);
    };
    S.switchTab._rotWrapped = true;
  }

  function init() {
    ensureChrome();
    wrapSwitch();
    applyTheme(currentTheme());
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "F7" && S.switchTab) {
        e.preventDefault();
        S.switchTab("rotation");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  S.openRotation = showRotation;
})(window.Scheduler);

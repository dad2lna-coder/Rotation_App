#!/usr/bin/env python3
"""Build one Blade+Rotation app. Rotation is an F7 tab in Blade chrome."""
import re
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BLADE_JS = [
    "constants.js","state.js","utils.js","shifts.js","allocation.js","functions.js",
    "render.js","line-colors.js","reports.js","schedule.js","io.js","airport.js",
    "capacity.js","modset-board.js","export-board.js","teams.js","team-build.js",
    "instructions.js","main.js","console-chrome.js","airfield-boot.js","setup-ui.js",
    "intro.js","team-form-smart.js","coverage-cuts.js","team-flags.js","team-close.js",
]
BLADE_BASE = "https://raw.githubusercontent.com/dad2lna-coder/BLADE_Alpha/main"

def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()

def main():
    site = ROOT / "_site"
    (site / "js").mkdir(parents=True, exist_ok=True)
    (site / "css").mkdir(parents=True, exist_ok=True)
    (site / "original_file").mkdir(parents=True, exist_ok=True)

    orig = (ROOT / "original_file" / "RotationBuilder 1.html").read_text(encoding="utf-8", errors="replace")
    style = orig[orig.find("<style>") + 7 : orig.find("</style>")]
    svg = orig[orig.find("<svg") : orig.find("</svg>") + 6]
    app = orig[orig.find('<div id="app">') : orig.find('<div class="toast"')]
    toast = orig[orig.find('<div class="toast"') : orig.find("<script>")]
    app = re.sub(r'<header class="top">.*?</header>', "", app, flags=re.S)
    app = re.sub(r'<footer class="blade-foot">.*?</footer>', "", app, flags=re.S)

    (site / "css" / "rotation.css").write_text(style, encoding="utf-8")
    overlay = ROOT / "css" / "rotation-blade.css"
    if overlay.exists():
        (site / "css" / "rotation-blade.css").write_text(overlay.read_text(encoding="utf-8"), encoding="utf-8")

    (site / "css" / "blade-app.css").write_bytes(fetch(BLADE_BASE + "/css/styles.css"))
    console = fetch(BLADE_BASE + "/css/console.css").decode("utf-8", "replace")
    console += """
.rot-theme-seg{display:inline-flex;border:1px solid var(--border,#c48a18)}
.rot-theme-seg button{background:transparent;border:0;border-right:1px solid var(--border,#c48a18);color:var(--text,#e0a020);font-family:inherit;text-transform:uppercase;letter-spacing:.06em;font-size:.72rem;min-height:2.2rem;padding:0 .65rem;cursor:pointer}
.rot-theme-seg button:last-child{border-right:0}
.rot-theme-seg button.active{background:#c48a18;color:#1a1204}
.panel{display:none}.panel.active{display:block}
"""
    (site / "css" / "console.css").write_text(console, encoding="utf-8")

    parts = [fetch(BLADE_BASE + "/lib/dayjs.min.js").decode("utf-8", "replace")]
    for n in BLADE_JS:
        parts.append(f"\n/* ==== {n} ==== */\n")
        parts.append(fetch(BLADE_BASE + "/js/" + n).decode("utf-8", "replace"))
    (site / "js" / "blade-app.js").write_text("".join(parts), encoding="utf-8")

    blade_html = fetch(BLADE_BASE + "/index.html").decode("utf-8", "replace")
    blade_main = blade_html[blade_html.find("<main>") + 6 : blade_html.find("</main>")]
    blade_main = blade_main.replace('class="panel active"', 'class="panel"', 1)
    blade_modals = blade_html[blade_html.find("</main>") + 7 : blade_html.find("<footer")]
    shell = (ROOT / "js" / "merged-shell.js").read_text(encoding="utf-8")
    (site / "js" / "merged-shell.js").write_text(shell, encoding="utf-8")

    index = f"""<!DOCTYPE html>
<html lang="en" class="console" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>BLADE + Rotation</title>
  <link rel="stylesheet" href="css/blade-app.css" />
  <link rel="stylesheet" href="css/console.css" />
  <link rel="stylesheet" href="css/rotation.css" />
  <link rel="stylesheet" href="css/rotation-blade.css" />
</head>
<body class="console-skin blade-shell">
  <header class="topbar">
    <div class="console-mast">
      <div class="brand">BLADE AIRPORT OPS<span>WORKFORCE + ROTATION</span></div>
      <div class="console-meta">AIRPORT: <b id="console-airport">DFW</b></div>
      <div class="console-meta">SCHEDULE WEEKS: <b id="console-weeks">1</b></div>
      <div class="console-meta">STAFF TOTAL: <b id="console-staff">—</b></div>
      <div class="console-meta">SYSTEM TIME: <b id="console-time">--:--:--</b></div>
      <div class="console-meta">DATE: <b id="console-date">--/--/----</b></div>
      <div class="console-status-chip">STATUS: READY</div>
    </div>
    <div class="topbar-actions">
      <button class="btn" id="btn-instructions">[HLP] INSTRUCTIONS</button>
      <button class="btn" id="btn-airport-config">[CFG] AIRFIELD</button>
      <button class="btn btn-amber" id="btn-generate">[GEN] GENERATE</button>
      <button class="btn" id="btn-export">[EXP] EXPORT</button>
      <button class="btn" id="btn-import">[IMP] IMPORT</button>
      <input type="file" id="file-import" accept="application/json,.json" style="display:none" />
      <button class="btn btn-red" id="btn-clear">[CLR] CLEAR</button>
      <div id="rot-theme-seg" class="rot-theme-seg" title="Rotation appearance">
        <button type="button" data-theme="dark">Dark</button>
        <button type="button" data-theme="light">Light</button>
        <button type="button" data-theme="vivid">Vivid</button>
      </div>
    </div>
  </header>
  <div class="status" id="status">Ready</div>
  <nav class="tabs">
    <button class="tab-btn" data-tab="setup">[F1] SETUP</button>
    <button class="tab-btn" data-tab="coverage">[F2] COVERAGE</button>
    <button class="tab-btn" data-tab="lines">[F3] LINES</button>
    <button class="tab-btn" data-tab="teams">[F4] TEAMS</button>
    <button class="tab-btn" data-tab="reports">[F5] REPORTS</button>
    <button class="tab-btn" data-tab="capacity">[F6] CAPACITY</button>
    <button class="tab-btn active" data-tab="rotation">[F7] ROTATION</button>
  </nav>
  <main>
{blade_main}
    <section class="panel active" id="tab-rotation">
{svg}
{app}
{toast}
    </section>
  </main>
{blade_modals}
  <footer class="console-footer">
    <span>SYSTEM STATUS: <b>READY</b></span>
    <span>NAV: F1–F7 · ROTATION IS A BLADE TAB</span>
  </footer>
  <script src="js/blade-app.js"></script>
  <script src="js/demo-data.js"></script>
  <script src="js/vendor/xlsx.js"></script>
  <script src="js/core/01-foundation.js"></script>
  <script src="js/core/02-roster.js"></script>
  <script src="js/core/03-projections.js"></script>
  <script src="js/engine/04-engine.js"></script>
  <script src="js/ui/05-render.js"></script>
  <script src="js/ui/06-theme.js"></script>
  <script src="js/ui/07-editing.js"></script>
  <script src="js/ui/08-config-ui.js"></script>
  <script src="js/merged-shell.js"></script>
</body>
</html>
"""
    (site / "index.html").write_text(index, encoding="utf-8")
    print("wrote", site / "index.html", len(index))

if __name__ == "__main__":
    main()

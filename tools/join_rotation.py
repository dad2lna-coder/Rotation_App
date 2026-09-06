#!/usr/bin/env python3
"""Patch Blade index.html so Rotation joins as [F7]."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
ORIG = ROOT / "original_file" / "RotationBuilder 1.html"


def main():
    html = INDEX.read_text(encoding="utf-8", errors="replace")
    orig = ORIG.read_text(encoding="utf-8", errors="replace")
    svg = orig[orig.find("<svg") : orig.find("</svg>") + 6]
    app = orig[orig.find('<div id="app">') : orig.find('<div class="toast"')]
    toast = orig[orig.find('<div class="toast"') : orig.find("<script>")]
    app = re.sub(r'<header class="top">.*?</header>', "", app, flags=re.S)
    app = re.sub(r'<footer class="blade-foot">.*?</footer>', "", app, flags=re.S)
    style = orig[orig.find("<style>") + 7 : orig.find("</style>")]
    (ROOT / "css").mkdir(exist_ok=True)
    (ROOT / "css" / "rotation-from-engine.css").write_text(style, encoding="utf-8")

    if 'data-tab="rotation"' not in html:
        html = html.replace(
            "[F6] CAPACITY</button>",
            '[F6] CAPACITY</button>\n    <button class="tab-btn" data-tab="rotation">[F7] ROTATION</button>',
        )
    if "rot-theme-seg" not in html:
        html = html.replace(
            '<button class="btn btn-red" id="btn-clear">[CLR] CLEAR</button>',
            """<button class="btn btn-red" id="btn-clear">[CLR] CLEAR</button>
      <div id="rot-theme-seg" class="rot-theme-seg">
        <button type="button" data-theme="dark">Dark</button>
        <button type="button" data-theme="light">Light</button>
        <button type="button" data-theme="vivid">Vivid</button>
      </div>""",
        )
    if 'id="tab-rotation"' not in html:
        html = html.replace(
            "</main>",
            f"""    <section class="panel" id="tab-rotation">
{svg}
{app}
{toast}
    </section>
  </main>""",
        )
    if "rotation-from-engine.css" not in html:
        html = html.replace(
            "css/console.css",
            'css/console.css" />\n  <link rel="stylesheet" href="css/rotation-from-engine.css',
        )
    if "rotation-blade.css" not in html:
        html = html.replace(
            "rotation-from-engine.css",
            'rotation-from-engine.css" />\n  <link rel="stylesheet" href="css/rotation-blade.css',
        )
    if 'id="fc-pool-bag"' not in html:
        html = html.replace(
            '<label>DFO TSO <input type="number" id="fc-pool-tso" min="0" value="0" style="width:4rem" /></label>',
            '<label>DFO TSO <input type="number" id="fc-pool-tso" min="0" value="4" style="width:4rem" /></label>'
            '<label>BAG TSO <input type="number" id="fc-pool-bag" min="0" value="2" style="width:4rem" /></label>'
            '<button type="button" class="btn btn-amber" id="fc-generate">Assign DFO / BAG days</button>',
        )
        html = html.replace('id="fc-pool-stso" min="0" value="0"', 'id="fc-pool-stso" min="0" value="1"')
        html = html.replace('id="fc-pool-ltso" min="0" value="0"', 'id="fc-pool-ltso" min="0" value="1"')
    extra_scripts = """
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
  <script src="js/blade-rotation-bridge.js"></script>
"""
    if "js/blade-rotation-bridge.js" not in html:
        html = html.replace("</body>", extra_scripts + "</body>")
    html = html.replace("NAV: F1–F6", "NAV: F1–F7")
    html = html.replace("<title>BLADE Alpha Build</title>", "<title>BLADE + Rotation</title>")
    INDEX.write_text(html, encoding="utf-8")
    print("joined rotation into Blade index", INDEX.stat().st_size)


if __name__ == "__main__":
    main()

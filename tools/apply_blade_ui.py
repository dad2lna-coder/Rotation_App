#!/usr/bin/env python3
"""Apply BLADE console chrome to Rotation Builder. Keep theme toggle."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "original_file" / "RotationBuilder 1.html"

BLADE_CSS = r"""
/* ===== BLADE chrome over Rotation tokens ===== */
html[data-theme] body{
  font-family:"Consolas","Lucida Console","Cascadia Mono","Courier New",monospace;
  letter-spacing:.02em;
}
html[data-theme] .top,
html[data-theme] .side,
html[data-theme] .tools,
html[data-theme] .sideFoot,
html[data-theme] .btn,
html[data-theme] input,
html[data-theme] select,
html[data-theme] textarea,
html[data-theme] .seg,
html[data-theme] .seg button,
html[data-theme] .badge,
html[data-theme] .pill,
html[data-theme] .modtag,
html[data-theme] .logo{
  border-radius:0 !important;
}
.blade-mast{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;
  width:100%;font-size:12px;text-transform:uppercase;letter-spacing:.08em;
}
.blade-mast .brand{flex-direction:column;align-items:flex-start;gap:0;font-weight:400}
.blade-mast .brand span.sub{display:block;font-size:10px;color:var(--tx2);letter-spacing:.14em}
.blade-meta{color:var(--tx2)}
.blade-meta b{color:var(--ac);font-weight:400}
.blade-chip{
  margin-left:auto;border:1px solid var(--ok);color:var(--ok);
  padding:3px 8px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
}
.top{
  display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;
  height:auto;min-height:var(--hdr-h);padding:8px 12px 6px;gap:8px 12px;align-items:center;
}
.top .blade-mast{grid-column:1 / -1}
.top .theme{grid-column:2;grid-row:2;justify-self:end}
.top #tabSeg{grid-column:1;grid-row:2}
.top #tabSeg button{text-transform:uppercase;letter-spacing:.08em}
.blade-foot{
  position:fixed;left:0;right:0;bottom:0;z-index:30;
  display:flex;flex-wrap:wrap;gap:6px 16px;
  padding:6px 12px;padding-bottom:calc(6px + env(safe-area-inset-bottom));
  background:var(--surf);border-top:1px solid var(--line);
  font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--tx2);
}
.blade-foot b{color:var(--ok);font-weight:400}
#app{padding-bottom:32px}
.btn,.seg button{text-transform:uppercase;letter-spacing:.06em}
.lbl{letter-spacing:.12em}

@media (max-width:720px){
  html,body{overflow:auto;height:auto;min-height:100%}
  #app{height:auto;min-height:100vh}
  .main{flex-direction:column;min-height:0}
  .side{width:100%;flex:0 0 auto;max-height:none;border-right:0;border-bottom:1px solid var(--line)}
  .sideScroll{max-height:none;overflow:visible}
  .work{min-height:70vh}
  .top{grid-template-columns:1fr}
  .top .theme,.top #tabSeg{grid-column:1;justify-self:stretch}
  .top #tabSeg{width:100%}
  .top #tabSeg button{flex:1}
  .scroll{-webkit-overflow-scrolling:touch}
}
"""

OLD_HEADER = """<header class=\"top\">
  <div class=\"brand\">
   <span class=\"logo\"><svg class=\"ic lg\"><use href=\"#i-logo\"/></svg></span>
   Rotation Builder
  </div>
  <span class=\"badge\" id=\"offBadge\"><span class=\"dot\"></span>Offline</span>

  <div class=\"topspace\"></div>

  <div class=\"seg theme\" id=\"themeSeg\" title=\"Appearance\">
   <button data-theme=\"dark\"  title=\"Dark\"><svg class=\"ic sm\"><use href=\"#i-moon\"/></svg></button>
   <button data-theme=\"light\" title=\"Light\"><svg class=\"ic sm\"><use href=\"#i-sun\"/></svg></button>
   <button data-theme=\"vivid\" title=\"Vivid\"><svg class=\"ic sm\"><use href=\"#i-spark\"/></svg></button>
  </div>

  <div class=\"seg pri\" id=\"tabSeg\">
   <button class=\"tab on\" data-v=\"build\"><svg class=\"ic sm\"><use href=\"#i-grid\"/></svg>Build Sheet</button>
   <button class=\"tab\" data-v=\"admin\"><svg class=\"ic sm\"><use href=\"#i-slider\"/></svg>Configuration</button>
  </div>
 </header>"""

NEW_HEADER = """<header class=\"top\">
  <div class=\"blade-mast\">
   <div class=\"brand\">
    BLADE / ROTATION
    <span class=\"sub\">Checkpoint rotation sheet</span>
   </div>
   <div class=\"blade-meta\">AIRPORT: <b>DFW</b></div>
   <div class=\"blade-meta\">DATE: <b id=\"bladeDate\">--/--/----</b></div>
   <div class=\"blade-meta\">SHIFT: <b id=\"bladeShift\">AM</b></div>
   <div class=\"blade-meta\">ROWS: <b id=\"bladeRows\">0</b></div>
   <span class=\"blade-chip\" id=\"offBadge\">STATUS: OFFLINE</span>
  </div>
  <div class=\"seg pri\" id=\"tabSeg\">
   <button class=\"tab on\" data-v=\"build\">[F1] Build Sheet</button>
   <button class=\"tab\" data-v=\"admin\">[F2] Configuration</button>
  </div>
  <div class=\"seg theme\" id=\"themeSeg\" title=\"Appearance\">
   <button data-theme=\"dark\" title=\"Dark\"><svg class=\"ic sm\"><use href=\"#i-moon\"/></svg></button>
   <button data-theme=\"light\" title=\"Light\"><svg class=\"ic sm\"><use href=\"#i-sun\"/></svg></button>
   <button data-theme=\"vivid\" title=\"Vivid\"><svg class=\"ic sm\"><use href=\"#i-spark\"/></svg></button>
  </div>
 </header>"""

FOOT = """ <footer class=\"blade-foot\">
  <span>SYSTEM: <b>READY</b></span>
  <span>NAV: F1 BUILD · F2 CONFIG</span>
  <span>THEME: DARK / LIGHT / VIVID</span>
  <span>DEMO: LOAD DEMO ROSTER THEN GENERATE</span>
 </footer>
"""


def main():
    text = SRC.read_text(encoding="utf-8", errors="replace")
    if "blade-mast" not in text:
        if OLD_HEADER not in text:
            raise SystemExit("header block not found")
        text = text.replace(OLD_HEADER, NEW_HEADER, 1)
    if "BLADE chrome over Rotation" not in text:
        idx = text.find("</style>")
        if idx < 0:
            raise SystemExit("no style block")
        text = text[:idx] + BLADE_CSS + text[idx:]
    if 'class="blade-foot"' not in text:
        if '<div class="toast" id="toast"></div>' in text:
            text = text.replace(
                '<div class="toast" id="toast"></div>',
                FOOT + '<div class="toast" id="toast"></div>',
                1,
            )
    text = text.replace(
        'width=device-width,initial-scale=1',
        'width=device-width,initial-scale=1,viewport-fit=cover',
        1,
    )
    hook = """
function syncBladeChrome(){
  const d = $("iDate") && $("iDate").value;
  const sh = $("iShift") && $("iShift").value;
  if($("bladeDate") && d) $("bladeDate").textContent = d;
  if($("bladeShift") && sh) $("bladeShift").textContent = sh;
  if($("bladeRows")) $("bladeRows").textContent = (S.roster && S.roster.length) ? S.roster.length : 0;
}
"""
    if "function syncBladeChrome" not in text:
        text = text.replace("function boot(){", hook + "function boot(){", 1)
    if "syncBladeChrome();" not in text:
        text = text.replace(
            '$("iShift").dispatchEvent(new Event("change"));',
            '$("iShift").dispatchEvent(new Event("change"));\n    syncBladeChrome();',
            1,
        )
        text = text.replace(
            'toast("Demo roster loaded — pick Generate.", "ok");',
            'toast("Demo roster loaded — pick Generate.", "ok");\n  syncBladeChrome();',
            1,
        )
    SRC.write_text(text, encoding="utf-8")
    print("blade ui applied", SRC, len(text))


if __name__ == "__main__":
    main()

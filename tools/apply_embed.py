#!/usr/bin/env python3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "original_file" / "RotationBuilder 1.html"
CSS = """
html.embed .blade-mast, html.embed .blade-foot, html.embed #tabSeg { display:none !important; }
html.embed .top { min-height:0; padding:4px 8px; }
html.embed .top .theme { justify-self:end; }
"""
HOOK = """
if(/embed=1/.test(location.search||"")) document.documentElement.classList.add("embed");
window.addEventListener("message", function(e){
  var d = e.data || {};
  if(d.type === "blade-theme" && d.theme && typeof setTheme === "function") setTheme(d.theme, true);
});
"""

def main():
    text = SRC.read_text(encoding="utf-8", errors="replace")
    if "html.embed .blade-mast" not in text:
        i = text.find("</style>")
        if i >= 0:
            text = text[:i] + CSS + text[i:]
    if "blade-theme" not in text:
        text = text.replace("function boot(){", HOOK + "\nfunction boot(){", 1)
    SRC.write_text(text, encoding="utf-8")
    print("embed hook applied")

if __name__ == "__main__":
    main()

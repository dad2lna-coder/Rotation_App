#!/usr/bin/env python3
"""Inject RB_DEMO and empty-DB boot fallback into an HTML/JS file."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DEMO = (ROOT / "js" / "demo-data.js").read_text(encoding="utf-8")

BOOT_OLD = """    if(pj){ S.proj = pj; S.projMeta = pm || {}; }
    if(r && r.length){ S.roster = r; S.meta = m || S.meta;"""

BOOT_NEW = """    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if(pj){ S.proj = pj; S.projMeta = pm || {}; }
    if(r && r.length){ S.roster = r; S.meta = m || S.meta;"""

LOC_OLD = """    fillTerms(); fillLocSelect(); renderAdmin(); wire(); refreshSaved();
    $("projInfo").innerHTML = projSummary();
    if(!$("iDate").value) $("iDate").value = todayKey();"""

LOC_NEW = """    fillTerms(); fillLocSelect(); renderAdmin(); wire(); refreshSaved();
    $("projInfo").innerHTML = projSummary();
    if(!$("iDate").value) $("iDate").value = todayKey();
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }"""


def bake(path: Path) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    if "window.RB_DEMO" not in text:
        if "function boot(){" not in text:
            raise SystemExit(f"no boot() in {path}")
        text = text.replace("function boot(){", DEMO + "\nfunction boot(){", 1)
    if BOOT_OLD in text:
        text = text.replace(BOOT_OLD, BOOT_NEW, 1)
    if LOC_OLD in text:
        text = text.replace(LOC_OLD, LOC_NEW, 1)
    path.write_text(text, encoding="utf-8")
    print(f"baked {path}")


def main():
    targets = sys.argv[1:] or [
        str(ROOT / "original_file" / "RotationBuilder 1.html"),
        str(ROOT / "js" / "ui" / "08-config-ui.js"),
    ]
    for t in targets:
        p = Path(t)
        if p.exists():
            bake(p)


if __name__ == "__main__":
    main()

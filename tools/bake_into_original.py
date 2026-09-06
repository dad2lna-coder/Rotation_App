#!/usr/bin/env python3
"""Embed demo roster/projections and a Load demo button into the monolith."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "original_file" / "RotationBuilder 1.html"
DEMO = ROOT / "js" / "demo-data.js"


def main():
    text = SRC.read_text(encoding="utf-8", errors="replace")
    demo = DEMO.read_text(encoding="utf-8")

    old_ui = (
        '     <button class="btn wide" id="bUpload"><svg class="ic sm"><use href="#i-upload"/></svg>Upload Roster</button>\n'
        '     <div class="hint" id="rosterInfo">No roster loaded.</div>'
    )
    new_ui = (
        '     <button class="btn wide" id="bUpload"><svg class="ic sm"><use href="#i-upload"/></svg>Upload Roster</button>\n'
        '     <div style="height:8px"></div>\n'
        '     <button class="btn wide sm" id="bDemo"><svg class="ic sm"><use href="#i-bolt"/></svg>Load demo roster</button>\n'
        '     <div class="hint" id="rosterInfo">No roster loaded. Use Load demo roster to try the tool.</div>'
    )
    if old_ui in text:
        text = text.replace(old_ui, new_ui, 1)

    load_fn = '''
function loadDemo(persist){
  if(!window.RB_DEMO || !RB_DEMO.roster){ toast("Demo data missing.", "err"); return; }
  S.roster = RB_DEMO.roster;
  S.meta = Object.assign({}, RB_DEMO.meta);
  S.proj = RB_DEMO.proj;
  S.projMeta = Object.assign({}, RB_DEMO.projMeta || {});
  if(persist !== false){
    DB.set("roster", S.roster); DB.set("rosterMeta", S.meta);
    DB.set("proj", S.proj); DB.set("projMeta", S.projMeta);
  }
  const d = (S.meta.dates || []);
  $("rosterInfo").innerHTML = "<b>" + S.roster.length + "</b> checkpoint rows · demo CKPT-A12" +
    (d.length ? "<br>" + d[0] : "") + "<br>(baked demo)";
  $("projInfo").innerHTML = (typeof projSummary === "function") ? projSummary() : "Demo projections loaded.";
  if(d.length) $("iDate").value = d[0];
  fillTerms(); fillLocSelect();
  if($("iLoc")){
    $("iLoc").value = "CKPT-A12";
    $("iLoc").dispatchEvent(new Event("change"));
  }
  if($("iShift")) $("iShift").value = "AM";
  toast("Demo roster loaded — pick Generate.", "ok");
}

'''
    if "window.RB_DEMO" not in text and "function boot(){" in text:
        text = text.replace("function boot(){", demo + "\n" + load_fn + "function boot(){", 1)
    elif "function loadDemo(" not in text and "function boot(){" in text:
        text = text.replace("function boot(){", load_fn + "function boot(){", 1)

    old = """    if(pj){ S.proj = pj; S.projMeta = pm || {}; }
    if(r && r.length){ S.roster = r; S.meta = m || S.meta;"""
    new = """    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if(pj){ S.proj = pj; S.projMeta = pm || {}; }
    if(r && r.length){ S.roster = r; S.meta = m || S.meta;"""
    if old in text:
        text = text.replace(old, new, 1)

    old2 = """    fillTerms(); fillLocSelect(); renderAdmin(); wire(); refreshSaved();
    $("projInfo").innerHTML = projSummary();
    if(!$("iDate").value) $("iDate").value = todayKey();"""
    new2 = """    fillTerms(); fillLocSelect(); renderAdmin(); wire(); refreshSaved();
    $("projInfo").innerHTML = projSummary();
    if(!$("iDate").value) $("iDate").value = todayKey();
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }"""
    if old2 in text:
        text = text.replace(old2, new2, 1)

    old3 = '$("bUpload").onclick = () => $("fRoster").click();'
    new3 = '$("bUpload").onclick = () => $("fRoster").click();\n  if($("bDemo")) $("bDemo").onclick = () => loadDemo(true);'
    if old3 in text and 'bDemo").onclick' not in text:
        text = text.replace(old3, new3, 1)

    SRC.write_text(text, encoding="utf-8")
    print(f"updated {SRC} ({len(text)} chars)")


if __name__ == "__main__":
    main()

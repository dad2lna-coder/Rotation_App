    /* SO pairing */
    for(const code in sexAt){
      const g = sexAt[code];
      if(g.length === 2 && g[0].sex === g[1].sex){
        g.forEach(x => markVio(x.rk, c));
        issues.push(`${m2t(sh.cols[c])}: ${code} has two ${g[0].sex==="F"?"female":"male"} officers — pairing requires one of each.`);
      }
    }
  }
  const box = $("liveIssues");
  if(box) box.remove();
  if(issues.length){
    const d = el("div","msg e"); d.id = "liveIssues";
    d.innerHTML = `<span><b>${issues.length} live rule violation${issues.length===1?"":"s"}:</b> ` +
      esc(issues.slice(0,6).join("  ·  ")) + (issues.length>6 ? ` … and ${issues.length-6} more.` : "") + "</span>";
    $("diagList").insertBefore(d, $("diagList").firstChild);
  }
}
function markVio(rk, c){
  const td = document.querySelector(`#sheetTable td.cel[data-rk="${CSS.escape(rk)}"][data-ci="${c}"]`);
  if(td) td.classList.add("vio");
}

/* ---- 4.6 exports ----------------------------------------- */
function sheetAOA(){
  const sh = S.sheet;
  const head = ["CERT?","NAME","TITLE","MOD"].concat(sh.cols.map(m2hhmm));
  const rows = [head];
  const byMod = {};
  sh.people.forEach(p => (byMod[p.mod ?? "?"] = byMod[p.mod ?? "?"] || []).push(p));
  const laneOf = {};
  sh.seats.forEach(st => { if(st.laneN) (laneOf[st.mod] = laneOf[st.mod] || new Set()).add(st.laneN); });
  Object.keys(byMod).sort().forEach(mk => {
    const lanes = [...(laneOf[mk] || [])].sort((a,b)=>a-b);
    rows.push([`MODSET ${mk}` + (lanes.length ? ` — lane${lanes.length>1?"s":""} ${lanes.join(" & ")}` : ""), "", "", ""]
      .concat(sh.cols.map(()=>"")));
    byMod[mk].forEach(p => {
      const rk = p.k + "|" + p.s;
      rows.push([p.quals, p.n, p.ti, mk === "?" ? "" : "M" + mk]
        .concat((sh.grid[rk]||[]).map(c => c ? c.c : "")));
    });
  });
  return rows;
}
function fileStem(){
  const sh = S.sheet;
  return `Rotation_${sh.locId}_${sh.shift}_${(sh.date||"nodate").replace(/-/g,"")}`;
}
function dl(blob, name){
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); }, 400);
}
function exportXlsx(){
  const sh = S.sheet;
  const info = [
    ["Location", sh.locId], ["Shift", sh.shift], ["Date", sh.date || ""],
    ["Window", m2t(sh.cols[0]) + "–" + m2t(sh.cols[sh.cols.length-1] + S.cfg.rules.slot)],
    ["Officers", sh.people.length], ["Positions", sh.seats.length],
    ["Seed", sh.seed], ["Generated", new Date().toLocaleString()], []
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetAOA());
  ws["!cols"] = [{wch:14},{wch:26},{wch:10},{wch:6}].concat(sh.cols.map(()=>({wch:6})));
  ws["!freeze"] = { xSplit:4, ySplit:1 };
  XLSX.utils.book_append_sheet(wb, ws, sh.shift);
  const d = XLSX.utils.aoa_to_sheet(info.concat(sh.diag.map(x => [({e:"BLOCKING",w:"WARNING",i:"INFO",g:"OK"})[x.k], x.m.replace(/<[^>]+>/g,"")])));
  d["!cols"] = [{wch:12},{wch:120}];
  XLSX.utils.book_append_sheet(wb, d, "Notes");
  const out = XLSX.write(wb, { bookType:"xlsx", type:"array" });
  dl(new Blob([out], { type:"application/octet-stream" }), fileStem() + ".xlsx");
  toast("Excel exported.", "ok");
}
function exportCsv(){
  const csv = sheetAOA().map(r => r.map(v => {
    const s = String(v==null?"":v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(",")).join("\r\n");
  dl(new Blob([csv], { type:"text/csv" }), fileStem() + ".csv");
  toast("CSV exported.", "ok");
}
/* ============================================================
   Section 5: configuration UI, persistence, bootstrap
   ============================================================ */

function saveCfg(){ return DB.set("config", S.cfg).then(()=>{ renderAdmin(); fillTerms(); fillLocSelect(); }); }

/* ---- 5.1 rules ------------------------------------------- */
function renderRules(){
  const R = S.cfg.rules;
  const set = (id,v)=>{ const e=$(id); if(e) e.value = v; };
  set("cSlot",R.slot); set("cSeamAM",R.seamAM); set("cSeamPM",R.seamPM); set("cFem",R.femPerMod);
  set("cBrkT",R.brkTarget); set("cBrkM",R.brkMax); set("cBrkH",R.brkHours); set("cLaneMin",R.laneMin);
  set("cDrop",R.dropOrder); set("cRing",R.ring);
  $("cAllowRepeat").checked = !!R.allowRepeat;
  $("cBreakClears").checked = !!R.breakClears;
  $("cFemScale").checked = !!R.femScale;
  $("cPinSingle").checked = !!R.pinSingle;
  $("cStrictShift").checked = R.strictShift !== false;
}
function wireRules(){
  const num = { cSlot:"slot", cFem:"femPerMod", cBrkT:"brkTarget", cBrkM:"brkMax", cBrkH:"brkHours", cLaneMin:"laneMin" };
  for(const id in num) $(id).onchange = e => { S.cfg.rules[num[id]] = +e.target.value; saveCfg(); };
  const txt = { cSeamAM:"seamAM", cSeamPM:"seamPM", cDrop:"dropOrder", cRing:"ring" };
  for(const id in txt) $(id).onchange = e => { S.cfg.rules[txt[id]] = e.target.value.trim(); saveCfg(); };
  const chk = { cAllowRepeat:"allowRepeat", cBreakClears:"breakClears", cFemScale:"femScale", cPinSingle:"pinSingle", cStrictShift:"strictShift" };
  for(const id in chk) $(id).onchange = e => { S.cfg.rules[chk[id]] = e.target.checked; saveCfg(); };
}

/* ---- 5.2 job titles -------------------------------------- */
function renderTitles(){
  const box = $("titleList"); box.innerHTML = "";
  const keys = Object.keys(S.cfg.titles).sort();
  keys.forEach(t => {
    const lab = el("label","chk");
    const cb = document.createElement("input"); cb.type="checkbox"; cb.checked = S.cfg.titles[t] !== 0;
    cb.onchange = () => { S.cfg.titles[t] = cb.checked ? 1 : 0; DB.set("config", S.cfg); };
    lab.appendChild(cb); lab.appendChild(document.createTextNode(t));
    box.appendChild(lab);
  });
}

/* ---- 5.3 locations --------------------------------------- */
function renderLocs(){
  const box = $("locList"); box.innerHTML = "";
  locList().forEach(id => {
    const L = S.cfg.locations[id];
    const d = el("details","acc");
    const sm = el("summary");
    sm.appendChild(document.createTextNode(id));
    const nLanes = L.mods.reduce((a,m)=>a+m.length,0);
    const cnt = el("span","scount", `T${L.t} · ${L.open}–${L.close} · ${nLanes} lane${nLanes===1?"":"s"} · ${L.mods.length} modset${L.mods.length===1?"":"s"}` +
      (L.kcm?" · KCM":"") + (L.exit && (L.exit.am||L.exit.pm) ? " · EXIT" : ""));
    sm.appendChild(cnt); d.appendChild(sm);
    const b = el("div");
    L.mods.forEach((lanes, mi) => {
      const row = el("div"); row.style.marginBottom = "6px";
      row.appendChild(el("span","lbl","Modset " + (mi+1) + (lanes.length===1 ? " — WTMD only, no Body Scanner" : "")));
      lanes.forEach(l => { const t = el("span","tag" + (l.ct?" ct":""), "Lane " + l.n + (l.ct ? " · CT" : "")); row.appendChild(t); });
      b.appendChild(row);
    });
    if(L.kcm) b.appendChild(el("div","hint","KCM window " + L.kcm.open + "–" + L.kcm.close));
    if(L.exit && (L.exit.am||L.exit.pm))
      b.appendChild(el("div","hint","Exit lane staffed on: " + [L.exit.am?"AM":"", L.exit.pm?"PM":""].filter(Boolean).join(" + ")));
    const btn = el("button","btn sm","Edit"); btn.style.marginTop = "8px";
    btn.onclick = () => openLocModal(id);
    b.appendChild(btn);
    const del = el("button","btn sm danger","Delete"); del.style.cssText = "margin-top:8px;margin-left:6px";
    del.onclick = () => confirmBox("Delete location", `Remove <b>${esc(id)}</b> from the configuration?`, () => { delete S.cfg.locations[id]; saveCfg(); toast("Location removed."); });
    b.appendChild(del);
    d.appendChild(b); box.appendChild(d);
  });
}
let LOC_EDIT = null;
function openLocModal(id){
  const isNew = !id;
  LOC_EDIT = { id: id || "", L: id ? JSON.parse(JSON.stringify(S.cfg.locations[id])) : { t:"A", open:"04:00", close:"20:00", mods:[[{n:1,ct:0},{n:2,ct:0}]], kcm:null, exit:{am:0,pm:0} } };
  $("locModTitle").textContent = isNew ? "Add Location" : "Edit " + id;
  drawLocModal();
  $("ovLoc").classList.add("on");
}
function drawLocModal(){
  const L = LOC_EDIT.L, b = $("locModBody");
  b.innerHTML = "";
  const g = el("div","g4");
  g.innerHTML =
    `<div><span class="lbl">Location ID</span><input id="lmId" value="${esc(LOC_EDIT.id)}" placeholder="CKPT-X00"></div>
     <div><span class="lbl">Terminal</span><input id="lmT" value="${esc(L.t)}" maxlength="2"></div>
     <div><span class="lbl">Open</span><input type="time" id="lmO" step="1800" value="${esc(L.open)}"></div>
     <div><span class="lbl">Close</span><input type="time" id="lmC" step="1800" value="${esc(L.close)}"></div>`;
  b.appendChild(g);

  const mw = el("div"); mw.style.marginTop = "16px";
  mw.appendChild(el("span","lbl","Modsets & Lanes"));
  L.mods.forEach((lanes, mi) => {
    const card = el("div"); card.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px";
    const hd = el("div"); hd.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px";
    hd.appendChild(el("b", null, "Modset " + (mi+1)));
    if(lanes.length === 1) hd.appendChild(el("span","tag","WTMD only — no Body Scanner"));
    const rmM = el("button","btn sm danger","Remove modset");
    rmM.style.marginLeft = "auto";
    rmM.onclick = () => { L.mods.splice(mi,1); drawLocModal(); };
    hd.appendChild(rmM); card.appendChild(hd);
    lanes.forEach((l, li) => {
      const r = el("div"); r.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:5px";
      const n = document.createElement("input"); n.type="number"; n.min=1; n.max=12; n.value=l.n; n.style.width="80px";
      n.onchange = () => { l.n = +n.value; };
      const ct = document.createElement("input"); ct.type="checkbox"; ct.checked=!!l.ct; ct.style.width="auto";
      ct.onchange = () => { l.ct = ct.checked ? 1 : 0; };
      const lab = el("label","chk"); lab.appendChild(ct); lab.appendChild(document.createTextNode("CT lane (requires " + S.cfg.ctQual + ")"));
      const rm = el("button","btn sm danger","×"); rm.onclick = () => { lanes.splice(li,1); drawLocModal(); };
      r.appendChild(el("span","hint","Lane #")); r.appendChild(n); r.appendChild(lab); r.appendChild(rm);
      card.appendChild(r);
    });
    const addL = el("button","btn sm","+ Lane");
    addL.onclick = () => { const mx = Math.max(0, ...L.mods.flat().map(x=>x.n)); lanes.push({ n:mx+1, ct:0 }); drawLocModal(); };
    card.appendChild(addL);
    mw.appendChild(card);
  });
  const addM = el("button","btn sm","+ Modset");
  addM.onclick = () => { const mx = Math.max(0, ...L.mods.flat().map(x=>x.n)); L.mods.push([{ n:mx+1, ct:0 }]); drawLocModal(); };
  mw.appendChild(addM);
  b.appendChild(mw);

  const ex = el("div"); ex.style.marginTop = "16px";
  ex.appendChild(el("span","lbl","Exit Lane — which shift's sheet carries it"));
  const rowE = el("div"); rowE.style.display = "flex"; rowE.style.gap = "16px";
  [["am","AM"],["pm","PM"]].forEach(([k,lbl]) => {
    const lab = el("label","chk"); const cb = document.createElement("input"); cb.type="checkbox";
    cb.checked = !!(L.exit && L.exit[k]); cb.style.width="auto";
    cb.onchange = () => { L.exit = L.exit || {am:0,pm:0}; L.exit[k] = cb.checked?1:0; };
    lab.appendChild(cb); lab.appendChild(document.createTextNode(lbl));
    rowE.appendChild(lab);
  });
  ex.appendChild(rowE);
  ex.appendChild(el("div","hint","A checkpoint can staff another checkpoint's exit lane — tick the shift on whichever sheet the officer should appear."));
  b.appendChild(ex);

  const kc = el("div"); kc.style.marginTop = "16px";
  kc.appendChild(el("span","lbl","KCM"));
  const kl = el("label","chk"); const kb = document.createElement("input"); kb.type="checkbox"; kb.checked=!!L.kcm; kb.style.width="auto";
  kb.onchange = () => { L.kcm = kb.checked ? { open:L.open, close:L.close } : null; drawLocModal(); };
  kl.appendChild(kb); kl.appendChild(document.createTextNode("This location has a KCM position"));
  kc.appendChild(kl);
  if(L.kcm){
    const r = el("div","g2");
    r.innerHTML = `<div><span class="lbl">KCM open</span><input type="time" id="lmKO" step="1800" value="${esc(L.kcm.open)}"></div>
                   <div><span class="lbl">KCM close</span><input type="time" id="lmKC" step="1800" value="${esc(L.kcm.close)}"></div>`;
    kc.appendChild(r);
  }
  b.appendChild(kc);
}
function saveLocModal(){
  const L = LOC_EDIT.L;
  const id = $("lmId").value.trim().toUpperCase();
  if(!id) return toast("Location ID required.", "err");
  L.t = $("lmT").value.trim().toUpperCase();
  L.open = $("lmO").value; L.close = $("lmC").value;
  if(L.kcm && $("lmKO")) { L.kcm.open = $("lmKO").value; L.kcm.close = $("lmKC").value; }
  L.mods = L.mods.filter(m => m.length);
  if(!L.mods.length) return toast("At least one modset with one lane is required.", "err");
  if(LOC_EDIT.id && LOC_EDIT.id !== id) delete S.cfg.locations[LOC_EDIT.id];
  S.cfg.locations[id] = L;
  $("ovLoc").classList.remove("on");
  saveCfg(); toast("Location saved.", "ok");
}

/* ---- 5.4 positions --------------------------------------- */
function renderPos(){
  const t = $("posTable");
  t.innerHTML = "<thead><tr><th>Family</th><th>Label</th><th>Scope</th><th>Seats</th><th></th></tr></thead>";
  const tb = el("tbody");
  S.cfg.positions.forEach((p, i) => {
    const tr = el("tr");
    tr.innerHTML = `<td><input value="${esc(p.fam)}" data-i="${i}" data-f="fam" style="width:70px"></td>
      <td><input value="${esc(p.label)}" data-i="${i}" data-f="label"></td>
      <td><select data-i="${i}" data-f="scope">
        <option value="lane"${p.scope==="lane"?" selected":""}>lane</option>
        <option value="mod"${p.scope==="mod"?" selected":""}>modset</option>
        <option value="site"${p.scope==="site"?" selected":""}>site</option></select></td>
      <td><input type="number" min="1" max="4" value="${p.seats}" data-i="${i}" data-f="seats" style="width:60px"></td>
      <td style="text-align:right"><button class="btn sm danger" data-del="${i}">×</button></td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  t.querySelectorAll("input,select").forEach(e => e.onchange = ev => {
    const i = +ev.target.dataset.i, f = ev.target.dataset.f;
    S.cfg.positions[i][f] = f === "seats" ? +ev.target.value : ev.target.value;
    DB.set("config", S.cfg); renderQualMap();
  });
  t.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    S.cfg.positions.splice(+b.dataset.del, 1); saveCfg();
  });
}

/* ---- 5.5 quals ------------------------------------------- */
function renderQuals(){
  const box = $("qualList"); box.innerHTML = "";
  S.cfg.quals.forEach((q, i) => {
    const t = el("span","tag x", q + " ×");
    t.title = "Remove qualification " + q;
    t.onclick = () => confirmBox("Remove qualification", `Remove <b>${esc(q)}</b>? Officers holding it will simply no longer show it.`, ()=>{ S.cfg.quals.splice(i,1); saveCfg(); });
    box.appendChild(t);
  });
  renderQualMap();
  const u = $("unkQuals");
  const keys = Object.keys(S.meta.unknown || {});
  if(!keys.length){ u.textContent = S.roster.length ? "None — every character matched a known qualification." : "Upload a roster to scan."; return; }
  u.innerHTML = "";
  keys.sort((a,b)=>S.meta.unknown[b]-S.meta.unknown[a]).forEach(ch => {
    const t = el("span","tag x", `${ch} (${S.meta.unknown[ch]}) +`);
    t.title = "Promote to a real qualification code";
    t.onclick = () => { if(!S.cfg.quals.includes(ch)) S.cfg.quals.push(ch); delete S.meta.unknown[ch]; saveCfg(); renderQuals(); toast("Added qualification " + ch, "ok"); };
    u.appendChild(t);
  });
  u.appendChild(el("div","hint","Click a character to promote it to a qualification code. Anything left here is ignored by the engine."));
}
function renderQualMap(){
  const t = $("qualMapTable");
  t.innerHTML = "<thead><tr><th>Position</th><th>Required qualifications (comma separated)</th></tr></thead>";
  const tb = el("tbody");
  S.cfg.positions.forEach(p => {
    const cur = (S.cfg.qualMap[p.fam] || []).join(",");
    const tr = el("tr");
    tr.innerHTML = `<td><b>${esc(p.fam)}</b> <span style="color:var(--tx3)">${esc(p.label)}</span></td>
                    <td><input value="${esc(cur)}" data-fam="${esc(p.fam)}" placeholder="none"></td>`;
    tb.appendChild(tr);
  });
  const tr = el("tr");
  tr.innerHTML = `<td><b>CT lanes</b> <span style="color:var(--tx3)">lane-specific seats only</span></td>
                  <td><input value="${esc(S.cfg.ctQual)}" id="ctQualIn" style="max-width:120px"></td>`;
  tb.appendChild(tr);
  t.appendChild(tb);
  t.querySelectorAll("input[data-fam]").forEach(e => e.onchange = ev => {
    const v = ev.target.value.toUpperCase().split(",").map(x=>x.trim()).filter(Boolean);
    if(v.length) S.cfg.qualMap[ev.target.dataset.fam] = v; else delete S.cfg.qualMap[ev.target.dataset.fam];
    DB.set("config", S.cfg);
  });
  const cq = $("ctQualIn");
  if(cq) cq.onchange = e => { S.cfg.ctQual = e.target.value.trim().toUpperCase(); DB.set("config", S.cfg); renderLanes(); };
}

/* ---- 5.6 column mapping / aliases / restrictions --------- */
function renderMap(){
  const box = $("mapList"); box.innerHTML = "";
  const labels = { id:"Employee ID", name:"Name", title:"Job title", posn:"Position (rank sort)", loc:"Location", shift:"Shift",
                   start:"Start time", end:"End time", sex:"Sex", quals:"Quals", date:"Date", remarks:"Remarks" };
  for(const k in S.cfg.colmap){
    const d = el("div");
    d.appendChild(el("span","lbl", labels[k] || k));
    const i = document.createElement("input");
    i.value = S.cfg.colmap[k];
    i.onchange = () => { S.cfg.colmap[k] = i.value.trim(); DB.set("config", S.cfg); };
    d.appendChild(i); box.appendChild(d);
  }
}
function renderAlias(){
  const t = $("aliasTable");
  t.innerHTML = "<thead><tr><th>Roster spelling</th><th>Canonical ID</th><th></th></tr></thead>";
  const tb = el("tbody");
  const ks = Object.keys(S.cfg.aliases);
  if(!ks.length) tb.innerHTML = '<tr><td colspan="3" style="color:var(--tx3)">No explicit aliases. Hyphen/space and zero-padding are normalised automatically.</td></tr>';
  ks.forEach(k => {
    const tr = el("tr");
    tr.innerHTML = `<td>${esc(k)}</td><td>${esc(S.cfg.aliases[k] || "(ignored)")}</td>
                    <td style="text-align:right"><button class="btn sm danger" data-k="${esc(k)}">×</button></td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  t.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { delete S.cfg.aliases[b.dataset.k]; saveCfg(); });
}
function renderRest(){
  const t = $("restTable");
  const ks = Object.keys(S.cfg.restrictions || {});
  $("restEmpty").style.display = ks.length ? "none" : "block";
  t.innerHTML = ks.length ? "<thead><tr><th>KronosID</th><th>Name</th><th>Allowed positions</th><th></th></tr></thead>" : "";
  if(!ks.length) return;
  const tb = el("tbody");
  ks.forEach(k => {
    const r = S.cfg.restrictions[k];
    const tr = el("tr");
    tr.innerHTML = `<td><code>${esc(k)}</code></td><td>${esc(r.name||"")}</td>
      <td><input value="${esc((r.allow||[]).join(", "))}" data-k="${esc(k)}"></td>
      <td style="text-align:right"><button class="btn sm danger" data-clr="${esc(k)}">Clear</button></td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  t.querySelectorAll("input[data-k]").forEach(e => e.onchange = ev => {
    S.cfg.restrictions[ev.target.dataset.k].allow = ev.target.value.toUpperCase().split(",").map(x=>x.trim()).filter(Boolean);
    DB.set("config", S.cfg);
  });
  t.querySelectorAll("[data-clr]").forEach(b => b.onclick = () => {
    confirmBox("Clear restriction", `Remove the restriction for <b>${esc(S.cfg.restrictions[b.dataset.clr].name||b.dataset.clr)}</b>?`,
      ()=>{ delete S.cfg.restrictions[b.dataset.clr]; saveCfg(); toast("Restriction cleared."); });
  });
}
function renderAdmin(){
  renderRules(); renderTitles(); renderLocs(); renderPos(); renderQuals(); renderProj();
  renderMap(); renderAlias(); renderRest(); storeInfo();
}
function storeInfo(){
  DB.keys().then(ks => {
    const sheets = ks.filter(k => String(k).startsWith("sheet:")).length;
    $("storeInfo").innerHTML = `Roster: <b>${S.roster.length}</b> rows${S.meta.file ? " from " + esc(S.meta.file) : ""}${S.meta.when ? " · loaded " + esc(S.meta.when) : ""}<br>Saved sheets: <b>${sheets}</b> · Locations: <b>${locList().length}</b> · Restrictions: <b>${Object.keys(S.cfg.restrictions||{}).length}</b>`;
  });
}

/* ---- 5.7 adjustments modal ------------------------------- */
function openAdj(){
  const locId = $("iLoc").value, date = $("iDate").value, shift = $("iShift").value;
  if(!locId) return toast("Select a location first.", "err");
  const win = currentWindow();
  const people = staffFor(S.roster, locId, date, win.first, win.last + S.cfg.rules.slot, S.cfg, null, $("iShift").value);
  const t = $("adjTable");
  t.innerHTML = "<thead><tr><th>Officer</th><th>Window</th><th>Absent</th><th>Training (HH:MM-HH:MM)</th><th>Restrict to</th></tr></thead>";
  const tb = el("tbody");
  people.forEach(p => {
    const a = S.adj[p.k] || {};
    const tr = el("tr");
    tr.innerHTML =
      `<td><b>${esc(p.n)}</b><div style="color:var(--tx3);font-size:11px">${esc(p.ti)} · ${esc(p.sex)} · ${esc(p.quals)}</div></td>
       <td style="color:var(--tx2)">${m2t(p.rawS)}–${m2t(p.rawE)}</td>
       <td><label class="chk"><input type="checkbox" data-k="${esc(p.k)}" data-f="out"${a.out?" checked":""}> out</label></td>
       <td><input data-k="${esc(p.k)}" data-f="train" value="${esc((a.train||[]).map(w=>m2t(w[0])+"-"+m2t(w[1])).join(", "))}" placeholder="e.g. 06:00-10:00"></td>
       <td><input data-k="${esc(p.k)}" data-f="restrict" value="${esc(((S.cfg.restrictions[p.k]||{}).allow||a.restrict||[]).join(", "))}" placeholder="e.g. EXIT"></td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  t.querySelectorAll("[data-k]").forEach(e => e.onchange = ev => {
    const k = ev.target.dataset.k, f = ev.target.dataset.f;
    S.adj[k] = S.adj[k] || {};
    if(f === "out") S.adj[k].out = ev.target.checked;
    else if(f === "train") S.adj[k].train = grabRanges(ev.target.value);
    else {
      const v = ev.target.value.toUpperCase().split(",").map(x=>x.trim()).filter(Boolean);
      S.adj[k].restrict = v;
      const nm = (people.find(p=>p.k===k)||{}).n || "";
      if(v.length) S.cfg.restrictions[k] = { name:nm, allow:v };
      else delete S.cfg.restrictions[k];
      DB.set("config", S.cfg);
    }
  });
  $("ovAdj").classList.add("on");
}

/* ---- 5.7b add officer to sheet --------------------------- */
let ADD_PICK = null;

function openAdd(mode, seedFrom){
  const locId = $("iLoc").value, date = $("iDate").value;
  if(!locId) return toast("Select a location first.", "err");
  const win = currentWindow();
  if(!win || !win.cols.length) return toast("No sheet window for this location and shift.", "err");

  /* modset picker mirrors the location's real modsets */
  const L = S.cfg.locations[locId];
  const sel = $("amMod");
  sel.innerHTML = '<option value="">Let the solver decide</option>';
  L.mods.forEach((lanes, mi) => {
    const on = lanes.filter(l => S.lanes[l.n] !== false);
    if(!on.length) return;
    const o = el("option", null, `Modset ${mi+1} — lane${on.length>1?"s":""} ${on.map(l=>l.n).join(" & ")}`);
    o.value = String(mi + 1); sel.appendChild(o);
  });

  /* source-location filter */
  const others = [...new Set(S.roster.filter(r => r.lo !== locId && (!date || !r.d || r.d === date)).map(r => r.lo))].sort();
  const sl = $("addSrcLoc");
  sl.innerHTML = '<option value="">All other locations</option>';
  others.forEach(o => { const op = el("option", null, o); op.value = o; sl.appendChild(op); });

  $("amStart").value = m2t(win.first);
  $("amEnd").value = m2t(win.last + S.cfg.rules.slot);
  ADD_PICK = null;
  if(seedFrom){
    $("amName").value = ""; $("amTitle").value = seedFrom.ti || "TSO";
    $("amSex").value = seedFrom.sex || "M"; $("amQuals").value = seedFrom.quals || "";
    if(seedFrom.mod != null) $("amMod").value = String(seedFrom.mod);
  }
  document.querySelectorAll("#addSeg button").forEach(x => {
    const on = x.dataset.add === (mode === "manual" ? "manual" : "roster");
    x.classList.toggle("on", on);
  });
  $("addRoster").style.display = mode === "manual" ? "none" : "";
  $("addManual").style.display = mode === "manual" ? "" : "none";
  drawAddList(); drawAdded();
  $("ovAdd").classList.add("on");
}

function drawAddList(){
  const locId = $("iLoc").value, date = $("iDate").value;
  const q = ($("addSearch").value || "").trim().toUpperCase();
  const src = $("addSrcLoc").value;
  const win = currentWindow();
  const box = $("addList"); box.innerHTML = "";

  const seen = {}, hits = [];
  for(const r of S.roster){
    if(r.lo === locId) continue;
    if(date && r.d && r.d !== date) continue;
    if(src && r.lo !== src) continue;
    if(q && !(String(r.n).toUpperCase().includes(q) || String(r.ti).toUpperCase().includes(q) || String(r.q).toUpperCase().includes(q))) continue;
    const key = r.k + "|" + r.lo + "|" + r.s;
    if(seen[key]) continue; seen[key] = 1;
    hits.push(r);
    if(hits.length >= 250) break;
  }

  if(!hits.length){
    box.innerHTML = '<div style="padding:16px;color:var(--tx3);font-size:12.5px">No officers match — widen the search or check the date.</div>';
    $("addCount").textContent = "";
    return;
  }
  hits.forEach(r => {
    const d = el("div", "pick");
    d.dataset.k = r.k; d.dataset.lo = r.lo; d.dataset.s = r.s;
    d.innerHTML =
      `<div><div class="pn">${esc(r.n)}</div><div class="pd">${esc(r.ti || "—")} · ${esc(r.x || "?")} · ${esc(r.q || "no quals")}</div></div>` +
      `<div class="pr">${esc(r.lo)}<br>${m2t(r.s)}–${m2t(r.e)}</div>`;
    d.onclick = () => {
      box.querySelectorAll(".pick.on").forEach(x => x.classList.remove("on"));
      d.classList.add("on");
      ADD_PICK = r;
    };
    box.appendChild(d);
  });
  $("addCount").textContent = `${hits.length} officer${hits.length===1?"":"s"} shown` + (hits.length >= 250 ? " (first 250 — narrow the search)" : "");
}

function drawAdded(){
  const box = $("addedList");
  if(!S.extra.length){ box.className = "hint"; box.textContent = "None yet."; return; }
  box.className = ""; box.innerHTML = "";
  S.extra.forEach((x, i) => {
    const t = el("span", "tag x", `${x.n} · ${x.ti}${x.mod ? " · M" + x.mod : ""}  ✕`);
    t.title = "Remove from this sheet";
    t.onclick = () => { S.extra.splice(i, 1); drawAdded(); };
    box.appendChild(t);
  });
}

function commitAdd(){
  const mode = $("addSeg").querySelector("button.on").dataset.add;
  const win = currentWindow();
  const modV = $("amMod").value;

  if(mode === "roster"){
    if(!ADD_PICK) return toast("Pick an officer from the list first.", "err");
    const r = ADD_PICK;
    if(S.extra.some(x => x.k === r.k)) return toast(r.n + " is already added.", "err");
    const w0 = win.first, w1 = win.last + S.cfg.rules.slot;
    const os = Math.max(r.s, w0), oe = Math.min(r.e, w1);
    const fits = (oe - os) >= S.cfg.rules.slot;
    S.extra.push({ k:r.k, n:r.n, ti:r.ti || "TSO", sex:r.x || "M", quals:r.q || "",
                   s: fits ? r.s : w0, e: fits ? r.e : w1,
                   mod: modV ? +modV : null, src: r.lo });
    if(!fits) toast(`${r.n} works ${m2t(r.s)}–${m2t(r.e)} at ${r.lo}; placed across the whole sheet window here.`, null);
    ADD_PICK = null;
    $("addList").querySelectorAll(".pick.on").forEach(x => x.classList.remove("on"));
  } else {
    const n = $("amName").value.trim();
    if(!n) return toast("Enter a name.", "err");
    const id = $("amId").value.trim() || ("MANUAL-" + uid().toUpperCase());
    if(S.extra.some(x => x.k === id)) return toast("That employee ID is already added.", "err");
    S.extra.push({
      k:id, n, ti:$("amTitle").value.trim() || "TSO", sex:$("amSex").value,
      quals:$("amQuals").value.trim().toUpperCase(),
      s:t2m($("amStart").value) != null ? t2m($("amStart").value) : win.first,
      e:t2m($("amEnd").value) != null ? t2m($("amEnd").value) : win.last + S.cfg.rules.slot,
      mod: modV ? +modV : null, src: null
    });
    $("amName").value = ""; $("amId").value = "";
  }
  drawAdded();
  toast("Added. Press Add & Re-solve to place them.", "ok");
}

/* ---- 5.8 saved sheets ------------------------------------ */
function sheetKey(loc,date,shift){ return "sheet:" + loc + "|" + (date||"nodate") + "|" + shift; }
function refreshSaved(){
  return DB.keys().then(ks => {
    const sel = $("iSaved"); sel.innerHTML = '<option value="">— saved sheets —</option>';
    S.savedIndex = {};
    ks.filter(k => String(k).startsWith("sheet:")).sort().forEach(k => {
      const lbl = String(k).slice(6).replace(/\|/g, "  ·  ");
      const o = el("option", null, lbl); o.value = k; sel.appendChild(o);
      S.savedIndex[String(k).slice(6)] = true;
    });
  });
}
function saveSheet(){
  const sh = S.sheet; if(!sh) return;
  const payload = {
    locId: sh.locId, date: sh.date, shift: sh.shift, seed: sh.seed,
    cols: sh.cols, lanes: S.lanes, locks: S.locks, adj: S.adj, extra: S.extra,
    modOverride: S.modOverride, removed: S.removed,
    people: sh.people.map(p => ({ k:p.k, n:p.n, ti:p.ti, sex:p.sex, quals:p.quals, s:p.s, e:p.e, rawS:p.rawS, rawE:p.rawE, mod:p.mod, restrict:p.restrict, notes:p.notes, breaks:p.breaks, pinned:p.pinned })),
    grid: sh.grid, seats: sh.seats, diag: sh.diag, saved: new Date().toISOString()
  };
  DB.set(sheetKey(sh.locId, sh.date, sh.shift), payload)
    .then(refreshSaved).then(()=>toast("Sheet saved locally.", "ok"));
}
function loadSheet(){
  const k = $("iSaved").value; if(!k) return toast("Pick a saved sheet.", "err");
  DB.get(k).then(p => {
    if(!p) return toast("Not found.", "err");
    S.lanes = p.lanes || {}; S.locks = p.locks || {}; S.adj = p.adj || {}; S.extra = p.extra || [];
    S.modOverride = p.modOverride || {}; S.removed = p.removed || {};
    S.seed = p.seed;
    $("iLoc").value = p.locId; $("iDate").value = p.date || ""; $("iShift").value = p.shift;
    fillLocSelect();
    S.sheet = { locId:p.locId, date:p.date, shift:p.shift, seed:p.seed, cols:p.cols, people:p.people, grid:p.grid, seats:p.seats, diag:p.diag };
    renderSheet();
    ["bXlsx","bCsv","bPrint","bSave","bReroll","bResolve","bAdjust","bClearMan","bAddOfficer"].forEach(i => $(i).disabled = false);
    toast("Sheet loaded.", "ok");
  });
}

/* ---- 5.9 briefcase / configured tool --------------------- */
function exportBriefcase(){
  DB.keys().then(ks => Promise.all(ks.map(k => DB.get(k).then(v => [k,v]))).then(pairs => {
    const bag = { app:"rotation-builder", v:APP_VER, when:new Date().toISOString(), data:{} };
    pairs.forEach(([k,v]) => bag.data[k] = v);
    dl(new Blob([JSON.stringify(bag)], { type:"application/json" }), "RotationBuilder_Briefcase_" + todayKey() + ".json");
    toast("Briefcase exported.", "ok");
  }));
}
function importBriefcase(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const bag = JSON.parse(fr.result);
      if(!bag.data) throw new Error("Not a briefcase file.");
      Promise.all(Object.keys(bag.data).map(k => DB.set(k, bag.data[k]))).then(()=>{
        toast("Briefcase imported — reloading.", "ok");
        setTimeout(()=>location.reload(), 700);
      });
    }catch(e){ toast("Import failed: " + e.message, "err"); }
  };
  fr.readAsText(file);
}
function exportConfiguredTool(){
  const baked = "<script id=\"bakedCfg\" type=\"application/json\">" +
                JSON.stringify(S.cfg).replace(/<\//g, "<\\/") + "<\/script>";
  const html = "<!DOCTYPE html>\n" + PRISTINE.replace("<!--BAKED-->", baked);
  dl(new Blob([html], { type:"text/html" }), "RotationBuilder_" + todayKey() + ".html");
  toast("Configured tool exported — share this file.", "ok");
}

/* ---- 5.10 roster upload ---------------------------------- */
function handleRoster(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const res = ingestWorkbook(fr.result, S.cfg);
      S.roster = res.rows;
      S.meta = { file:file.name, rows:res.rows.length, when:new Date().toLocaleString(),
                 dates:Object.keys(res.dates).sort(), unknown:res.unknownQuals, locs:res.locsSeen };
      DB.set("roster", S.roster); DB.set("rosterMeta", S.meta);
      const d = S.meta.dates;
      $("rosterInfo").innerHTML = `<b>${res.rows.length}</b> checkpoint rows · ${Object.keys(res.locsSeen).length} locations` +
        (d.length ? `<br>${d[0]} → ${d[d.length-1]}` : "") + `<br>${esc(file.name)}`;
      if(d.length && !$("iDate").value) $("iDate").value = d.includes(todayKey()) ? todayKey() : d[0];
      renderQuals(); storeInfo();
      if(res.noId) $("rosterInfo").innerHTML += `<br><span style="color:var(--warn)">No <b>${esc(S.cfg.colmap.id)}</b> column — names used as keys. Persistent restrictions will not survive a name change.</span>`;
      if(res.soft && res.soft.length) $("rosterInfo").innerHTML += `<br><span style="color:var(--tx3)">Optional columns not found: ${esc(res.soft.join(", "))}</span>`;
      const unk = Object.keys(res.unknownQuals).length;
      toast(`Roster loaded — ${res.rows.length} rows` + (unk ? `, ${unk} unrecognised qual character(s)` : ""), "ok");
    }catch(e){ toast(e.message, "err"); $("rosterInfo").innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`; }
  };
  fr.readAsArrayBuffer(file);
}

/* ---- 5.10b projections ----------------------------------- */
function projSummary(){
  const keys = Object.keys(S.proj || {});
  if(!keys.length) return "None loaded — lane demand will not be checked.";
  const locs = [...new Set(keys.map(k => k.split("|")[0]))];
  const dates = [...new Set(keys.map(k => k.split("|")[1]).filter(Boolean))].sort();
  return `<b>${locs.length}</b> checkpoint${locs.length===1?"":"s"} · ` +
         (dates.length ? `${dates[0]}${dates.length>1?" → "+dates[dates.length-1]:""}` : "no dates") +
         `<br>${esc(locs.slice(0,6).join(", "))}${locs.length>6?" …":""}`;
}

function handleProjections(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const res = ingestProjections(fr.result, S.cfg);
      S.proj = Object.assign({}, S.proj, res.data);
      S.projMeta = { file:file.name, when:new Date().toLocaleString(), rows:res.rows,
                     locs:res.locs, dates:res.dates, metrics:res.metrics, unmatched:res.unmatched };
      DB.set("proj", S.proj); DB.set("projMeta", S.projMeta);
      $("projInfo").innerHTML = projSummary();
      const um = Object.keys(res.unmatched || {});
      if(um.length) $("projInfo").innerHTML += `<br><span style="color:var(--warn)">Counted as standard: ${esc(um.join(", "))}</span>`;
      renderProj();
      toast(`Projections loaded — ${res.rows} rows, ${Object.keys(res.locs).length} checkpoint(s).`, "ok");
      if(S.sheet) generate(false);
    }catch(e){
      toast(e.message, "err");
      $("projInfo").innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`;
    }
  };
  fr.readAsArrayBuffer(file);
}

function renderProj(){
  const P = S.cfg.proj;
  const set = (id, v) => { const e = $(id); if(e) e.value = v; };
  set("pMode", P.mode); set("pPax", P.paxPerLane); set("pPre", P.prePerLane);
  set("pPeak", P.peakFactor); set("pMin", P.minLanes);
  set("pFirst", P.firstLaneStaff); set("pExtra", P.extraLaneStaff);
  set("pStdKey", P.stdKey); set("pPreKey", P.preKey);
  const keys = Object.keys(S.proj || {});
  set("pLoaded", keys.length ? keys.length + " checkpoint-days" : "nothing loaded");

  const step = P.paxPerLane;
  $("pExplain").innerHTML =
    `At ${step} passengers per lane per hour: up to ${step} → 1 lane, up to ${step*2} → 2, up to ${step*3} → 3, and so on, ` +
    `capped at the lanes the checkpoint physically has. ` +
    (P.mode === "standard" ? "PreCheck volume is ignored." :
     P.mode === "combined" ? "PreCheck and standard volume are added together and divided by the standard rate." :
     `PreCheck is sized separately at ${P.prePerLane} per lane per hour and added on top.`) +
    (P.peakFactor !== 1 ? ` Every hour is multiplied by ${P.peakFactor} to allow for surges inside the hour.` : "");

  const box = $("pMapList"); box.innerHTML = "";
  const labels = { date:"Date", term:"Terminal", ckpt:"Checkpoint", metric:"Metric", value:"Value", hour:"Hour of day" };
  for(const k in P.colmap){
    const d = el("div");
    d.appendChild(el("span","lbl", labels[k] || k));
    const i = document.createElement("input");
    i.value = P.colmap[k];
    i.onchange = () => { P.colmap[k] = i.value.trim(); DB.set("config", S.cfg); };
    d.appendChild(i); box.appendChild(d);
  }
}

function wireProj(){
  $("bProj").onclick = () => $("fProj").click();
  $("fProj").onchange = e => { if(e.target.files[0]) handleProjections(e.target.files[0]); e.target.value = ""; };
  const num = { pPax:"paxPerLane", pPre:"prePerLane", pPeak:"peakFactor", pMin:"minLanes",
                pFirst:"firstLaneStaff", pExtra:"extraLaneStaff" };
  for(const id in num) $(id).onchange = e => {
    S.cfg.proj[num[id]] = Number(e.target.value); DB.set("config", S.cfg); renderProj();
    if(S.sheet) generate(false);
  };
  $("pMode").onchange = e => { S.cfg.proj.mode = e.target.value; DB.set("config", S.cfg); renderProj(); if(S.sheet) generate(false); };
  $("pStdKey").onchange = e => { S.cfg.proj.stdKey = e.target.value.trim(); DB.set("config", S.cfg); };
  $("pPreKey").onchange = e => { S.cfg.proj.preKey = e.target.value.trim(); DB.set("config", S.cfg); };
}

/* ---- 5.11 bootstrap -------------------------------------- */
function wire(){
  document.querySelectorAll("#themeSeg button").forEach(b => b.onclick = () => setTheme(b.dataset.theme));
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    const v = b.dataset.v;
    $("buildView").classList.toggle("on", v === "build");
    $("adminView").classList.toggle("on", v === "admin");
    $("sideBar").style.display = v === "build" ? "" : "none";
  });
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = e => e.target.closest(".ov").classList.remove("on"));
  document.querySelectorAll(".ov").forEach(o => o.onclick = e => { if(e.target === o) o.classList.remove("on"); });

  $("bUpload").onclick = () => $("fRoster").click();
  if($("bDemo")) $("bDemo").onclick = () => loadDemo(true);
  $("fRoster").onchange = e => { if(e.target.files[0]) handleRoster(e.target.files[0]); e.target.value = ""; };
  $("iTerm").onchange = fillLocSelect;
  $("iLoc").onchange = () => {
    S.lanes = {}; S.extra = []; S.modOverride = {}; S.removed = {}; renderLanes();
    const L = S.cfg.locations[$("iLoc").value];
    if(L){ $("iStart").value = ""; $("iEnd").value = ""; }
  };
  $("iShift").onchange = () => { $("shiftHint").textContent = $("iShift").value === "AM"
      ? `AM ends ${S.cfg.rules.seamAM}` : `PM starts ${S.cfg.rules.seamPM} · carries the AM seam if saved`; };
  $("bGen").onclick = () => generate(true);
  $("bReroll").onclick = () => { S.locks = {}; generate(true); };
  $("bResolve").onclick = () => generate(false);
  $("bClearMan").onclick = () => { S.locks = {}; generate(false); toast("Manual edits and cleared rows restored."); };
  $("bAdjust").onclick = openAdj;
  $("bAddOfficer").onclick = () => openAdd();
  $("bAddApply").onclick = () => { commitAdd(); if(S.extra.length){ $("ovAdd").classList.remove("on"); generate(false); } };
  $("addSearch").oninput = drawAddList;
  $("addSrcLoc").onchange = drawAddList;
  document.querySelectorAll("#addSeg button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#addSeg button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    $("addRoster").style.display = b.dataset.add === "roster" ? "" : "none";
    $("addManual").style.display = b.dataset.add === "manual" ? "" : "none";
  });
  $("diagToggle").onclick = () => {
    S.diagMin = !S.diagMin;
    $("diagPanel").classList.toggle("min", S.diagMin);
    DB.set("diagMin", S.diagMin);
  };
  $("bAdjApply").onclick = () => { $("ovAdj").classList.remove("on"); generate(false); };
  $("bXlsx").onclick = exportXlsx;
  $("bCsv").onclick = exportCsv;
  $("bPrint").onclick = () => window.print();
  $("bSave").onclick = saveSheet;
  $("bLoad").onclick = loadSheet;
  $("bDelSheet").onclick = () => {
    const k = $("iSaved").value; if(!k) return toast("Pick a saved sheet.", "err");
    confirmBox("Delete sheet", "Remove <b>" + esc(String(k).slice(6)) + "</b> from local storage?", ()=>DB.del(k).then(refreshSaved).then(()=>toast("Deleted.")));
  };
  $("bAddLoc").onclick = () => openLocModal(null);
  $("bLocSave").onclick = saveLocModal;
  $("bAddPos").onclick = () => { S.cfg.positions.push({ fam:"NEW", label:"New position", scope:"lane", seats:1 }); saveCfg(); };
  $("bAddQual").onclick = () => {
    const v = $("iNewQual").value.trim().toUpperCase();
    if(!v) return;
    if(!S.cfg.quals.includes(v)) S.cfg.quals.push(v);
    $("iNewQual").value = ""; saveCfg();
  };
  $("bAddAlias").onclick = () => {
    const f = $("iAliasFrom").value.trim().toUpperCase();
    if(!f) return;
    S.cfg.aliases[f] = $("iAliasTo").value.trim().toUpperCase();
    $("iAliasFrom").value = ""; $("iAliasTo").value = ""; saveCfg();
  };
  $("bExpCfg").onclick = () => dl(new Blob([JSON.stringify(S.cfg,null,2)],{type:"application/json"}), "RotationConfig_" + todayKey() + ".json");
  $("bImpCfg").onclick = () => $("fCfg").click();
  $("fCfg").onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    const fr = new FileReader();
    fr.onload = () => { try{ S.cfg = Object.assign(defaultConfig(), JSON.parse(fr.result)); saveCfg(); toast("Configuration imported.", "ok"); }
                        catch(x){ toast("Invalid config file.", "err"); } };
    fr.readAsText(f); e.target.value = "";
  };
  $("bResetCfg").onclick = () => confirmBox("Reset configuration", "Restore all rules, locations, positions and qualifications to defaults? Saved sheets and the roster are kept.", ()=>{ S.cfg = defaultConfig(); saveCfg(); toast("Defaults restored.", "ok"); });
  $("bBuildTool").onclick = exportConfiguredTool;
  $("bExpAll").onclick = exportBriefcase;
  $("bImpAll").onclick = () => $("fAll").click();
  $("fAll").onchange = e => { if(e.target.files[0]) importBriefcase(e.target.files[0]); e.target.value = ""; };
  $("bWipe").onclick = () => confirmBox("Wipe local data", "Delete the roster, all saved sheets and the configuration from this browser. This cannot be undone.", ()=>{
    DB.keys().then(ks => Promise.all(ks.map(k => DB.del(k)))).then(()=>{ toast("Local data wiped."); setTimeout(()=>location.reload(), 600); });
  });
  wireRules(); wireProj();

  document.addEventListener("click", e => {
    const clr = e.target.closest("[data-clear]");
    if(clr){ e.preventDefault(); clearRow(clr.dataset.clear); return; }
    if(S.sheet){
      const nameTd = e.target.closest("#sheetTable td.name");
      if(nameTd && !nameTd.querySelector("select")){ beginNameEdit(nameTd); return; }
      const modTd = e.target.closest("#sheetTable td.modcol");
      if(modTd && !modTd.querySelector("select")){ beginModEdit(modTd); return; }
    }
    if(PEDIT && !e.target.closest("select")) closePEdit();
    const td = e.target.closest("td.cel");
    document.querySelectorAll("td.cel.sel").forEach(x => x.classList.remove("sel"));
    if(!td || !S.sheet) return;
    if(td.classList.contains("off")) return;
    if(td.querySelector("select")) return;
    td.classList.add("sel");
    beginEdit(td);
  });
  document.addEventListener("keydown", e => {
    if(EDITING) return;
    const sel = document.querySelector("td.cel.sel");
    if(sel && (e.key === "Enter" || e.key === "F2")){ e.preventDefault(); beginEdit(sel); }
    if(e.key === "Escape" && $("ovAdd").classList.contains("on")) $("ovAdd").classList.remove("on");
  });
  window.addEventListener("beforeprint", () => { if(EDITING) endEdit(true); });
  let _rz = null;
  window.addEventListener("resize", () => { clearTimeout(_rz); _rz = setTimeout(syncSticky, 120); });
}

window.RB_DEMO = {"roster":[{"k":"10001","n":"Rivera, Ana","ti":"TSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"F","q":"1234ZAB","ab":[],"tr":[],"nt":[]},{"k":"10002","n":"Chen, Wei","ti":"TSO","po":"X-ray","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"M","q":"1234ZA","ab":[],"tr":[],"nt":[]},{"k":"10003","n":"Patel, Priya","ti":"TSO","po":"Divest","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"F","q":"1234AB","ab":[],"tr":[],"nt":[]},{"k":"10004","n":"Nguyen, Minh","ti":"TSO","po":"PSO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"M","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10005","n":"Brooks, Taylor","ti":"LTSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"F","q":"1234ZABC","ab":[],"tr":[],"nt":[]},{"k":"10006","n":"Johnson, Marcus","ti":"TSO","po":"WTMD","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":270,"e":780,"x":"M","q":"1234A","ab":[],"tr":[],"nt":[]},{"k":"10007","n":"Garcia, Elena","ti":"TSO","po":"SO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":270,"e":780,"x":"F","q":"1234ZB","ab":[],"tr":[],"nt":[]},{"k":"10008","n":"Kim, David","ti":"TSO","po":"SO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":270,"e":780,"x":"M","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10009","n":"Okafor, Nia","ti":"TSO","po":"X-ray","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":300,"e":810,"x":"F","q":"1234ZA","ab":[],"tr":[],"nt":[]},{"k":"10010","n":"Sullivan, Pat","ti":"TSO","po":"Divest","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":300,"e":810,"x":"M","q":"1234AB","ab":[],"tr":[],"nt":[]},{"k":"10011","n":"Hassan, Omar","ti":"TSO","po":"PSO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":300,"e":810,"x":"M","q":"1234","ab":[],"tr":[],"nt":[]},{"k":"10012","n":"Lee, Sophia","ti":"Phase 1","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":330,"e":840,"x":"F","q":"12Z","ab":[],"tr":[],"nt":[]},{"k":"10013","n":"Martinez, Luis","ti":"TSO","po":"EXIT","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"M","q":"1234","ab":[],"tr":[],"nt":[]},{"k":"10014","n":"Wright, Jordan","ti":"TSO/DFO","po":"KCM","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":720,"x":"F","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10015","n":"Brown, Chris","ti":"TSO","po":"X-ray","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":360,"e":870,"x":"M","q":"1234ZA","ab":[],"tr":[[360,420]],"nt":["Training"]},{"k":"10016","n":"Ali, Samira","ti":"TSO","po":"Divest","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":360,"e":870,"x":"F","q":"1234AB","ab":[],"tr":[],"nt":[]},{"k":"10017","n":"Thompson, Reed","ti":"LTSO","po":"PSO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":360,"e":870,"x":"M","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10018","n":"Diaz, Camila","ti":"TSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":420,"e":930,"x":"F","q":"1234ZAB","ab":[],"tr":[],"nt":[]},{"k":"10019","n":"Park, Jin","ti":"TSO","po":"SO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":420,"e":930,"x":"M","q":"1234A","ab":[],"tr":[],"nt":[]},{"k":"10020","n":"Foster, Maya","ti":"TSO","po":"WTMD","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":420,"e":930,"x":"F","q":"1234ZB","ab":[],"tr":[],"nt":[]},{"k":"10021","n":"Bennett, Alex","ti":"TSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"M","q":"1234","ab":[null],"tr":[],"nt":["Call off"]},{"k":"10022","n":"Singh, Anika","ti":"TSO","po":"PSO","lo":"CKPT-A12","d":"2026-09-06","sh":"AM","s":240,"e":750,"x":"F","q":"1234Z","ab":[null],"tr":[],"nt":["Leave: sick"]},{"k":"10023","n":"Cole, Riley","ti":"TSO","po":"X-ray","lo":"CKPT-A21","d":"2026-09-06","sh":"AM","s":180,"e":690,"x":"M","q":"1234ZA","ab":[],"tr":[],"nt":[]},{"k":"10024","n":"Hughes, Morgan","ti":"TSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":690,"e":1200,"x":"F","q":"1234ZAB","ab":[],"tr":[],"nt":[]},{"k":"10025","n":"Vargas, Diego","ti":"TSO","po":"X-ray","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":690,"e":1200,"x":"M","q":"1234ZA","ab":[],"tr":[],"nt":[]},{"k":"10026","n":"Quinn, Avery","ti":"TSO","po":"Divest","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":690,"e":1200,"x":"F","q":"1234AB","ab":[],"tr":[],"nt":[]},{"k":"10027","n":"Reed, Nolan","ti":"TSO","po":"PSO","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":720,"e":1200,"x":"M","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10028","n":"Ibarra, Lucia","ti":"LTSO","po":"SO","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":720,"e":1200,"x":"F","q":"1234ZB","ab":[],"tr":[],"nt":[]},{"k":"10029","n":"Walsh, Casey","ti":"TSO","po":"SO","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":720,"e":1200,"x":"M","q":"1234A","ab":[],"tr":[],"nt":[]},{"k":"10030","n":"Nguyen, Hoa","ti":"TSO","po":"WTMD","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":720,"e":1200,"x":"F","q":"1234","ab":[],"tr":[],"nt":[]},{"k":"10031","n":"Grant, Ellis","ti":"TSO","po":"TDC","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":780,"e":1200,"x":"M","q":"1234Z","ab":[],"tr":[],"nt":[]},{"k":"10032","n":"Sato, Yuki","ti":"TSO","po":"X-ray","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":780,"e":1200,"x":"F","q":"1234ZA","ab":[],"tr":[],"nt":[]},{"k":"10033","n":"Price, Dana","ti":"TSO","po":"Divest","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":780,"e":1200,"x":"M","q":"1234","ab":[],"tr":[],"nt":[]},{"k":"10034","n":"Owens, Blair","ti":"TSO","po":"EXIT","lo":"CKPT-A12","d":"2026-09-06","sh":"PM","s":690,"e":1200,"x":"F","q":"1234","ab":[],"tr":[],"nt":[]}],"meta":{"file":"(baked demo)","rows":34,"when":"baked","dates":["2026-09-06"],"unknown":{},"locs":{"CKPT-A12":33,"CKPT-A21":1}},"proj":{"CKPT-A12|2026-09-06":{4:{"std":80,"pre":40},5:{"std":160,"pre":90},6:{"std":280,"pre":160},7:{"std":420,"pre":220},8:{"std":380,"pre":200},9:{"std":310,"pre":150},10:{"std":240,"pre":120},11:{"std":220,"pre":110},12:{"std":200,"pre":100},13:{"std":210,"pre":110},14:{"std":230,"pre":120},15:{"std":260,"pre":140},16:{"std":300,"pre":160},17:{"std":340,"pre":180},18:{"std":220,"pre":100},19:{"std":90,"pre":40}}},"projMeta":{"file":"(baked demo)","rows":32,"locs":{"CKPT-A12":1},"dates":["2026-09-06"]}};


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
  syncBladeChrome();
}


function syncBladeChrome(){
  const d = $("iDate") && $("iDate").value;
  const sh = $("iShift") && $("iShift").value;
  if($("bladeDate") && d) $("bladeDate").textContent = d;
  if($("bladeShift") && sh) $("bladeShift").textContent = sh;
  if($("bladeRows")) $("bladeRows").textContent = (S.roster && S.roster.length) ? S.roster.length : 0;
}

if(/embed=1/.test(location.search||"")) document.documentElement.classList.add("embed");
window.addEventListener("message", function(e){
  var d = e.data || {};
  if(d.type === "blade-theme" && d.theme && typeof setTheme === "function") setTheme(d.theme, true);
});

function boot(){
  const baked = document.getElementById("bakedCfg");
  let bakedCfg = null;
  if(baked){ try{ bakedCfg = JSON.parse(baked.textContent); }catch(e){} }

  DB.get("theme").then(t => setTheme(t || "dark", false)).catch(()=>setTheme("dark", false));
  DB.get("diagMin").then(v => { S.diagMin = !!v; }).catch(()=>{});

  DB.get("config").then(c => {
    S.cfg = Object.assign(defaultConfig(), bakedCfg || {}, c || {});
    S.cfg.rules = Object.assign(defaultConfig().rules, (bakedCfg&&bakedCfg.rules)||{}, (c&&c.rules)||{});
    if(!c && bakedCfg) DB.set("config", S.cfg);
    return Promise.all([DB.get("roster"), DB.get("rosterMeta"), DB.get("proj"), DB.get("projMeta")]);
  }).then(([r, m, pj, pm]) => {
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if((!r || !r.length) && window.RB_DEMO && RB_DEMO.roster){
      r = RB_DEMO.roster; m = RB_DEMO.meta;
    }
    if(!pj && window.RB_DEMO && RB_DEMO.proj){
      pj = RB_DEMO.proj; pm = RB_DEMO.projMeta;
    }
    if(pj){ S.proj = pj; S.projMeta = pm || {}; }
    if(r && r.length){ S.roster = r; S.meta = m || S.meta;
      const d = (S.meta.dates||[]);
      $("rosterInfo").innerHTML = `<b>${r.length}</b> checkpoint rows${S.meta.locs?" · "+Object.keys(S.meta.locs).length+" locations":""}` +
        (d.length ? `<br>${d[0]} → ${d[d.length-1]}` : "") + (S.meta.file ? `<br>${esc(S.meta.file)}` : "");
      if(d.length) $("iDate").value = d.includes(todayKey()) ? todayKey() : d[0];
    }
    fillTerms(); fillLocSelect(); renderAdmin(); wire(); refreshSaved();
    $("projInfo").innerHTML = projSummary();
    if(!$("iDate").value) $("iDate").value = todayKey();
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(window.RB_DEMO && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    if(S.roster && S.roster.length && $("iLoc") && !$("iLoc").value){
      $("iLoc").value = "CKPT-A12";
      $("iLoc").dispatchEvent(new Event("change"));
    }
    $("iShift").dispatchEvent(new Event("change"));
    syncBladeChrome();

  }).catch(e => {
    console.error(e);
    fillTerms(); fillLocSelect(); renderAdmin(); wire();
    toast("Local storage unavailable — the tool still runs, but nothing will persist.", "err");
  });
}
/* debugging handle — lets a support session inspect state from the console */
window.RB = { S, generate, solve, renderSheet, sheetAOA, exportCsv, exportXlsx,
              exportConfiguredTool, ingestWorkbook, staffFor, sheetWindow,
              buildSeats, buildRings, beginEdit, endEdit, validateAll, m2t, t2m, DB,
              setTheme, clearRow, openAdd, commitAdd, extraToPerson, syncSticky,
              beginNameEdit, beginModEdit, swapOfficer, removeOfficer, benchOfficers,
              ingestProjections, laneDemand, lanesFor, staffableLanes, handleProjections };

boot();
</script>
</body>


      (sh.grid[rk] || []).forEach((cell, ci) => {
        const td = el("td", "cel " + (cell ? cell.t : "off"));
        td.dataset.rk = rk; td.dataset.ci = ci;
        if(cell && cell.man) td.classList.add("man");
        if(cell && cell.c && cell.t !== "off")
          td.title = `${p.n} · ${m2t(sh.cols[ci])}–${m2t(sh.cols[ci] + slot)} · ${cell.fam ? posLabel(cell.fam) : cell.c}`;
        td.appendChild(el("span", "cw", cell ? cell.c : ""));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });

  });
  t.appendChild(tb);
  wrap.insertBefore(t, $("printLegend"));

  /* ---------- meta pills ---------- */
  const nE = sh.diag.filter(d => d.k === "e").length, nW = sh.diag.filter(d => d.k === "w").length;
  const nMods = modKeys.filter(k => k !== "?").length;
  $("sheetMeta").innerHTML =
    `<span class="pill ac"><b>${esc(sh.locId)}</b> ${esc(sh.shift)}</span>` +
    `<span class="pill">${esc(sh.date || "no date")}</span>` +
    `<span class="pill">${m2t(sh.cols[0])}–${m2t(wEnd)}</span>` +
    `<span class="pill"><b>${sh.people.length}</b> officers</span>` +
    `<span class="pill"><b>${nMods}</b> modset${nMods === 1 ? "" : "s"} · <b>${sh.seats.length}</b> positions</span>` +
    (nE ? `<span class="pill bad">${nE} blocking</span>` : "") +
    (nW ? `<span class="pill warn">${nW} warning${nW === 1 ? "" : "s"}</span>` : "") +
    (!nE && !nW ? `<span class="pill ok">clean</span>` : "") +
    `<span class="pill">seed ${sh.seed}</span>`;

  /* ---------- projection diagnostics ---------- */
  if(dem.has){
    const P = S.cfg.proj;
    const shortHrs = dem.hours.filter(h => h.open < h.need);
    const understaffed = dem.hours.filter(h => h.open >= h.need && h.staffable < h.need);
    const overCap = dem.hours.filter(h => h.uncapped > h.physical);
    const slack = dem.hours.filter(h => h.need != null && h.open > h.need);

    const fmt = hs => hs.map(h => `${m2t(h.from)} (${h.pax} pax → ${h.need} lane${h.need===1?"":"s"}, ${h.open} open)`).join(" · ");
    if(shortHrs.length)
      sh.diag.unshift({ k:"e", m:`<b>Lanes short of projected demand:</b> ${fmt(shortHrs)}. Open more lanes or expect queues.` });
    if(overCap.length)
      sh.diag.unshift({ k:"e", m:`<b>Demand exceeds this checkpoint:</b> ` +
        overCap.map(h => `${m2t(h.from)} needs ${h.uncapped} lanes, only ${h.physical} exist`).join(" · ") +
        `. Divert passengers or open another checkpoint.` });
    if(understaffed.length)
      sh.diag.push({ k:"w", m:`<b>Lanes open but not staffable:</b> ` +
        understaffed.map(h => `${m2t(h.from)} needs ${h.need}, staff supports ${h.staffable}`).join(" · ") +
        `. Based on ${P.firstLaneStaff} officers for the first lane and ${P.extraLaneStaff} for each extra.` });
    if(slack.length)
      sh.diag.push({ k:"i", m:`<b>Lanes available to close:</b> ` +
        slack.map(h => `${m2t(h.from)}–${m2t(h.to)} needs ${h.need} of ${h.open}`).join(" · ") + `.` });
    const pk = dem.hours.reduce((a, h) => (h.pax > (a ? a.pax : -1) ? h : a), null);
    if(pk) sh.diag.push({ k:"i", m:`Peak hour ${m2t(pk.from)}–${m2t(pk.to)}: <b>${pk.pax} passengers</b>, ${pk.need} lane${pk.need===1?"":"s"} required. Throughput assumed ${P.paxPerLane}/lane/hour${P.peakFactor!==1?`, peak factor ${P.peakFactor}`:""}.` });
  } else if(Object.keys(S.proj || {}).length){
    sh.diag.push({ k:"i", m:`No passenger projections loaded for ${esc(sh.locId)} on ${esc(sh.date || "this date")}.` });
  }

  /* ---------- diagnostics ---------- */
  const dl = $("diagList"); dl.innerHTML = "";
  const rank = { e:0, w:1, i:2, g:3 };
  const icon = { e:"i-alert", w:"i-alert", i:"i-info", g:"i-check" };
  sh.diag.slice().sort((a, b) => rank[a.k] - rank[b.k]).forEach(d => {
    const m = el("div", "msg " + d.k);
    m.innerHTML = `<svg class="ic sm"><use href="#${icon[d.k] || "i-info"}"/></svg><span>${d.m}</span>`;
    dl.appendChild(m);
  });
  const counts = { e:nE, w:nW, i:sh.diag.filter(d=>d.k==="i").length, g:sh.diag.filter(d=>d.k==="g").length };
  $("diagCount").innerHTML =
    (counts.e ? `<span class="cnt e">${counts.e} blocking</span> ` : "") +
    (counts.w ? `<span class="cnt w">${counts.w} warning</span> ` : "") +
    (counts.i ? `<span class="cnt i">${counts.i} info</span> ` : "") +
    (counts.g ? `<span class="cnt g">all clear</span>` : "");
  syncSticky();
  $("diagPanel").style.display = "flex";
  $("diagPanel").classList.toggle("min", !!S.diagMin);
  $("legendBar").style.display = "flex";
  validateAll();
}

/* ============================================================
   Officer-level editing: swap the person on a row, or move them
   to a different modset. Both open a dropdown in place.
   ============================================================ */
let PEDIT = null;

function closePEdit(){
  if(!PEDIT) return;
  const { host, restore } = PEDIT;
  PEDIT = null;
  host.innerHTML = ""; restore();
}

/* Officers at this location, date and shift who are not already on the sheet. */
function benchOfficers(){
  const sh = S.sheet;
  if(!sh) return [];
  const win = currentWindow();
  const onSheet = {}; sh.people.forEach(p => onSheet[p.k] = 1);
  const all = staffFor(S.roster, sh.locId, sh.date, win.first, win.last + S.cfg.rules.slot,
                       S.cfg, S.adj, sh.shift);
  return all.filter(p => !onSheet[p.k]).sort((a, b) => a.n.localeCompare(b.n));
}

function beginNameEdit(td){
  closePEdit(); if(EDITING) endEdit(true);
  const sh = S.sheet, rk = td.dataset.rk;
  const p = sh.people.find(x => (x.k + "|" + x.s) === rk);
  if(!p) return;
  const html = td.innerHTML;

  const sel = document.createElement("select");
  sel.className = "namesel";
  const add = (v, label, group) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = label;
    (group || sel).appendChild(o);
    return o;
  };
  add("__keep", p.n + "  (current)");

  const bench = benchOfficers();
  if(bench.length){
    const g = document.createElement("optgroup");
    g.label = "Swap in — not yet on this sheet";
    bench.forEach(b => add("k:" + b.k, `${b.n} · ${b.ti} · ${b.sex} · ${b.quals || "no quals"}`, g));
    sel.appendChild(g);
  }
  const g2 = document.createElement("optgroup"); g2.label = "Other";
  add("__manual", "Type a new officer…", g2);
  add("__remove", "Remove from this sheet", g2);
  sel.appendChild(g2);

  td.innerHTML = ""; td.appendChild(sel);
  PEDIT = { host: td, restore: () => { td.innerHTML = html; } };
  sel.focus();
  if(typeof sel.showPicker === "function"){ try{ sel.showPicker(); }catch(e){} }
  sel.onblur = () => closePEdit();
  sel.onkeydown = e => { if(e.key === "Escape") closePEdit(); };
  sel.onchange = () => {
    const v = sel.value;
    PEDIT = null;
    if(v === "__keep"){ td.innerHTML = html; return; }
    if(v === "__remove"){
      confirmBox("Remove officer",
        `Take <b>${esc(p.n)}</b> off this sheet? Their positions will be re-solved among everyone else.`,
        () => { removeOfficer(p); });
      td.innerHTML = html; return;
    }
    if(v === "__manual"){ td.innerHTML = html; openAdd("manual", p); return; }
    swapOfficer(p, v.slice(2));
  };
}

/* Replace the officer on a row, keeping that row's assignments as locks so
   the sheet keeps its shape — quals are re-checked and flagged, not blocked. */
function swapOfficer(oldP, newKey){
  const sh = S.sheet;
  const win = currentWindow();
  const cand = staffFor(S.roster, sh.locId, sh.date, win.first, win.last + S.cfg.rules.slot,
                        S.cfg, S.adj, sh.shift).find(x => x.k === newKey);
  if(!cand) return toast("That officer is no longer available.", "err");

  const oldRk = oldP.k + "|" + oldP.s;
  const row = (sh.grid[oldRk] || []).slice();

  S.removed[oldP.k] = 1;
  S.extra = S.extra.filter(x => x.k !== oldP.k);
  if(oldP.mod != null) S.modOverride[cand.k] = oldP.mod;

  S.extra.push({ k:cand.k, n:cand.n, ti:cand.ti, sex:cand.sex, quals:cand.quals,
                 s:cand.rawS, e:cand.rawE, mod:oldP.mod, src:"swap" });

  /* carry the row's assignments onto the incoming officer */
  const person = extraToPerson(S.extra[S.extra.length - 1], win);
  const newRk = person.k + "|" + person.s;
  const carry = {};
  row.forEach((c, i) => { if(c && c.c && c.t !== "off") carry[i] = c.c; });
  delete S.locks[oldRk];
  S.locks[newRk] = carry;

  generate(false);
  toast(`${cand.n} replaced ${oldP.n} — assignments kept.`, "ok");
}

function removeOfficer(p){
  S.removed[p.k] = 1;
  S.extra = S.extra.filter(x => x.k !== p.k);
  delete S.locks[p.k + "|" + p.s];
  generate(false);
  toast(`${p.n} removed from this sheet.`);
}

function beginModEdit(td){
  closePEdit(); if(EDITING) endEdit(true);
  const sh = S.sheet, rk = td.dataset.rk;
  const p = sh.people.find(x => (x.k + "|" + x.s) === rk);
  if(!p) return;
  const html = td.innerHTML;
  const mods = [...new Set(sh.seats.map(s => s.mod))].filter(m => m != null).sort((a, b) => a - b);

  const sel = document.createElement("select");
  sel.className = "modsel";
  mods.forEach(m => {
    const lanes = [...new Set(sh.seats.filter(s => s.mod === m && s.laneN).map(s => s.laneN))].sort((a,b)=>a-b);
    const o = document.createElement("option");
    o.value = String(m);
    o.textContent = `M${m} — Modset ${m}` + (lanes.length ? ` — lane${lanes.length>1?"s":""} ${lanes.join(" & ")}` : "");
    sel.appendChild(o);
  });
  const oa = document.createElement("option");
  oa.value = "__auto"; oa.textContent = "Let the solver decide";
  sel.appendChild(oa);
  sel.value = p.mod != null ? String(p.mod) : "__auto";

  td.innerHTML = ""; td.appendChild(sel);
  PEDIT = { host: td, restore: () => { td.innerHTML = html; } };
  sel.focus();
  if(typeof sel.showPicker === "function"){ try{ sel.showPicker(); }catch(e){} }
  sel.onblur = () => closePEdit();
  sel.onkeydown = e => { if(e.key === "Escape") closePEdit(); };
  sel.onchange = () => {
    const v = sel.value;
    PEDIT = null;
    if(v === "__auto") delete S.modOverride[p.k];
    else S.modOverride[p.k] = Number(v);
    /* their old seats belong to the old modset, so drop those locks */
    delete S.locks[p.k + "|" + p.s];
    generate(false);
    toast(v === "__auto" ? `${p.n} — modset back to automatic.`
                         : `${p.n} moved to modset ${v}.`, "ok");
  };
}

/* Measure the frozen columns and publish their real left offsets.
   Hard-coding them drifts the moment a width, font or padding changes,
   and a drifted offset makes the frozen block sit on top of the grid. */
function syncSticky(){
  const t = document.getElementById("sheetTable");
  if(!t) return;
  /* the modset legend strip is sticky too, so the header must sit under it */
  const lg = document.getElementById("sheetLegend");
  const lh = (lg && lg.offsetParent !== null) ? lg.getBoundingClientRect().height : 0;
  t.style.setProperty("--legendH", Math.round(lh) + "px");

  const rows = t.querySelectorAll("thead tr");
  const hs = rows[0] ? rows[0].querySelectorAll("th.hs") : [];
  let x = 0;
  hs.forEach((h, i) => {
    t.style.setProperty("--sL" + (i + 1), Math.round(x) + "px");
    x += h.getBoundingClientRect().width;
  });
  t.style.setProperty("--sWidth", Math.round(x) + "px");
  /* the demand strip is a second sticky header row, so it sits under the first */
  const r1h = rows[0] ? rows[0].getBoundingClientRect().height : 0;
  t.style.setProperty("--hdrRow1", Math.round(r1h) + "px");
}

/* Clear every assignment on one officer's row. Leave, training and
   off-shift blocks are left alone; cleared cells lock so Re-solve
   keeps them clear until the user says otherwise. */
function clearRow(rk){
  const sh = S.sheet; if(!sh || !sh.grid[rk]) return;
  S.locks[rk] = S.locks[rk] || {};
  let n = 0;
  sh.grid[rk].forEach((cell, ci) => {
    if(!cell || cell.t === "off" || cell.t === "lv" || cell.t === "trn") return;
    if(cell.c === "—" ) return;
    S.locks[rk][ci] = "—";
    sh.grid[rk][ci] = { c:"—", t:"sur", man:1 };
    n++;
  });
  renderSheet();
  toast(n ? `Cleared ${n} position${n === 1 ? "" : "s"} — Re-solve will keep the row clear.` : "Nothing to clear on that row.", n ? "ok" : null);
}

/* ---- 4.4 manual editing — every cell is a dropdown -------- */
let EDITING = null;

/* Options offered for one cell, grouped: this officer's own modset
   first, then every other position, then the status codes. */
function cellGroups(rk){
  const sh = S.sheet;
  const p = sh.people.find(x => (x.k + "|" + x.s) === rk);
  const mine = [], other = [], seen = {};
  const posLabel = f => (S.cfg.positions.find(q => q.fam === f) || {}).label || f;
  sh.seats.forEach(st => {
    if(seen[st.code]) return; seen[st.code] = 1;
    const lbl = st.code + " — " + posLabel(st.fam) + (st.laneN ? " · lane " + st.laneN : "");
    ((p && st.mod === p.mod) ? mine : other).push([st.code, lbl]);
  });
  const g = [];
  if(mine.length) g.push([p && p.mod != null ? "Modset " + p.mod : "This modset", mine]);
  if(other.length) g.push(["Other modsets", other]);
  g.push(["Status", [["B","B — Break"],["TRN","TRN — Training"],["LV","LV — Leave / call-off"],["—","— Unassigned"]]]);
  return g;
}

function beginEdit(td){
  if(EDITING) endEdit(true);
  const rk = td.dataset.rk, ci = +td.dataset.ci;
  const cell = S.sheet.grid[rk][ci];
  if(cell && cell.t === "off") return;

  const sel = document.createElement("select");
  sel.className = "cellsel";
  cellGroups(rk).forEach(([label, opts]) => {
    const og = document.createElement("optgroup"); og.label = label;
    opts.forEach(([v, l]) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = l;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  const cur = cell && cell.c ? cell.c : "—";
  if(![...sel.options].some(o => o.value === cur)){
    const o = document.createElement("option"); o.value = cur; o.textContent = cur;
    sel.insertBefore(o, sel.firstChild);
  }
  sel.value = cur;

  td.textContent = ""; td.appendChild(sel);
  EDITING = { td, rk, ci, sel };
  sel.focus();
  if(typeof sel.showPicker === "function"){ try{ sel.showPicker(); }catch(e){} }

  sel.onchange = () => endEdit(true);
  sel.onblur   = () => endEdit(true);
  sel.onkeydown = e => {
    if(e.key === "Escape"){ e.preventDefault(); endEdit(false); }
    else if(e.key === "Enter"){ e.preventDefault(); endEdit(true); }
    else if(e.key === "Tab"){
      e.preventDefault();
      const next = td.nextElementSibling;
      endEdit(true);
      if(next && next.classList.contains("cel") && !next.classList.contains("off")) beginEdit(next);
    }
  };
}

function endEdit(commit){
  if(!EDITING) return;
  const { td, rk, ci, sel } = EDITING;
  const v = commit ? String(sel.value || "").trim() : null;
  EDITING = null;

  if(commit){
    const seat = S.sheet.seats.find(x => x.code === v || x.id === v);
    S.locks[rk] = S.locks[rk] || {};
    S.locks[rk][ci] = v;
    S.sheet.grid[rk][ci] = {
      c: v,
      t: v === "B" ? "brk" : v === "TRN" ? "trn" : v === "LV" ? "lv" : v === "—" ? "sur"
         : (seat && seat.fam === "SO") ? "so" : "on",
      id: seat ? seat.id : null, fam: seat ? seat.fam : null, man: 1
    };
  }
  const cell = S.sheet.grid[rk][ci];
  td.className = "cel " + cell.t + (cell.man ? " man" : "");
  td.textContent = ""; td.appendChild(el("span", "cw", cell.c));

  /* Picking a position that belongs to another modset moves the officer
     there — the number on the code is the modset, so the two must agree. */
  if(commit && cell.id){
    const seat = S.sheet.seats.find(x => x.id === cell.id);
    const p = S.sheet.people.find(x => (x.k + "|" + x.s) === rk);
    if(seat && p && seat.mod != null && p.mod !== seat.mod){
      S.modOverride[p.k] = seat.mod;
      p.mod = seat.mod;
      toast(`${p.n} moved to modset ${seat.mod} — ${cell.c} belongs to that modset.`, "ok");
      renderSheet();
      return;
    }
  }
  if(commit) validateAll();
}

/* ---- 4.5 live validation --------------------------------- */
function validateAll(){
  const sh = S.sheet; if(!sh) return;
  const cfg = S.cfg;
  const byId = {}; sh.seats.forEach(s => byId[s.id] = s);
  const pByRk = {}; sh.people.forEach(p => pByRk[p.k + "|" + p.s] = p);
  const issues = [];

  document.querySelectorAll("#sheetTable td.cel.vio").forEach(td => td.classList.remove("vio"));

  for(let c = 0; c < sh.cols.length; c++){
    const used = {}, sexAt = {};
    for(const rk in sh.grid){
      const cell = sh.grid[rk][c]; if(!cell || !cell.c || ["B","TRN","LV","—",""].includes(cell.c)) continue;
      const p = pByRk[rk]; if(!p) continue;
      (used[cell.c] = used[cell.c] || []).push(rk);
      /* CT / qual check */
      const seat = sh.seats.find(s => s.code === cell.c && (s.mod === p.mod || true));
      if(seat && !seatAllows(cfg, p, seat)){
        markVio(rk, c);
        issues.push(`${m2t(sh.cols[c])}: ${p.n} at ${cell.c} lacks a required qualification.`);
      }
      /* consecutive repeat */
      if(!cfg.rules.allowRepeat && c > 0 && !cell.pin && !cell.forced){
        const prev = sh.grid[rk][c-1];
        if(prev && prev.c === cell.c && !["B","TRN","LV","—",""].includes(prev.c)){
          markVio(rk, c);
          issues.push(`${m2t(sh.cols[c])}: ${p.n} repeats ${cell.c} back-to-back.`);
        }
      }
      if(cell.c.startsWith("SO")) (sexAt[cell.c] = sexAt[cell.c] || []).push({ rk, sex:p.sex });
    }
    /* over-capacity on a single code */
    for(const code in used){
      const seatN = sh.seats.filter(s => s.code === code).length || 1;
      if(used[code].length > seatN){
        used[code].forEach(rk => markVio(rk, c));
        issues.push(`${m2t(sh.cols[c])}: ${used[code].length} officers on ${code} (capacity ${seatN}).`);
      }
    }

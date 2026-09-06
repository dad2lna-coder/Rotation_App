    for(const s of active) if(!taken[s.id]) (unmanned[s.id] = unmanned[s.id] || []).push(t);
  }

  /* ---- 3.6.3 apply manual locks -------------------------- */
  if(locks) for(const rk in locks){
    if(!grid[rk]) continue;
    for(const ci in locks[rk]){
      const v = locks[rk][ci];
      const s = seats.find(x => x.code === v || x.id === v);
      grid[rk][+ci] = { c:v,
      t: v === "B" ? "brk" : v === "TRN" ? "trn" : v === "LV" ? "lv" : v === "—" ? "sur"
         : (s && s.fam === "SO") ? "so" : "on",
      id:s?s.id:null, fam:s?s.fam:null, man:1 };
    }
  }

  /* ---- 3.6.4 diagnostics --------------------------------- */
  for(const m of mods){
    const grp = people.filter(p => p.mod === m);
    const hasSO = seatsByMod[m].some(s => s.fam === "SO");
    const need = hasSO ? R.femPerMod : (R.femScale ? 0 : R.femPerMod);

    /* headcount is judged per column: a modset that starts strong and empties
       out mid-shift is the case that actually forces a lane closure. */
    let worst = Infinity, worstT = null, worstF = Infinity, worstFT = null;
    for(let c = 0; c < cols.length; c++){
      const t = cols[c];
      const on = grp.filter(p => presentAt(p, t, st) === "on" && p.breaks.indexOf(c) < 0 && !p.pinned);
      const all = grp.filter(p => presentAt(p, t, st) === "on");
      if(!all.length) continue;
      if(all.length < worst){ worst = all.length; worstT = t; }
      const f = all.filter(p => p.sex === "F").length;
      if(f < worstF){ worstF = f; worstFT = t; }
    }
    if(worst === Infinity) continue;

    if(need && worstF < need)
      diag.push({ k:"e", m:`Modset ${m}: down to <b>${worstF} female officer${worstF===1?"":"s"}</b> at ${m2t(worstFT)} (minimum ${need}). Pull a female LTSO onto the modset, or override — Body Scanner pairing cannot hold without cover.` });
    if(worst < R.laneMin)
      diag.push({ k:"e", m:`Modset ${m}: down to <b>${worst} officer${worst===1?"":"s"}</b> at ${m2t(worstT)} (threshold ${R.laneMin}). Close a lane, request help, or move surplus staff over manually.` });
  }
  const unmannedList = Object.keys(unmanned);
  if(unmannedList.length){
    const summary = unmannedList.map(id => `${byId[id]?byId[id].code:id} (${unmanned[id].length}×)`).join(", ");
    diag.push({ k:"w", m:`Unmanned position-slots: ${summary}. Drop order in effect: ${esc(R.dropOrder)}.` });
  }
  const surTotal = surplusCols.reduce((a,x)=>a+(x?x.length:0),0);
  if(surTotal){
    const names = [...new Set([].concat(...surplusCols.filter(Boolean)))];
    diag.push({ k:"i", m:`<b>Surplus staffing:</b> ${surTotal} unassigned officer-slots. Available to move to another location: ${esc(names.join(", "))}. Assign manually to a third lane or reassign.` });
  }
  const noBrk = people.filter(p => p.breaks.length === 0 && (p.e - p.s) >= 4*60);
  if(noBrk.length) diag.push({ k:"w", m:`No break scheduled for: ${esc(noBrk.map(p=>p.n).join(", "))}.` });
  if(!diag.length) diag.push({ k:"g", m:"All constraints satisfied — gender pairing, CT qualification, breaks and coverage." });

  return { seats, cols, grid, people, rings, diag, seed, seatsByMod };
}
/* ============================================================
   Section 4: application state, sheet rendering, exports
   ============================================================ */

const PRISTINE = document.documentElement.outerHTML;

const S = {
  cfg: defaultConfig(),
  roster: [],
  meta: { file:"", rows:0, when:"", dates:[], unknown:{} },
  sheet: null,
  locks: {},
  adj: {},
  lanes: {},
  extra: [],          /* officers added by hand for this sheet */
  proj: {},           /* "CKPT-x|YYYY-MM-DD" -> { hour: {std, pre} } */
  projMeta: {},
  modOverride: {},    /* KronosID -> modset the supervisor moved them to */
  removed: {},        /* KronosID -> 1, taken off this sheet */
  seed: 0,
  theme: "dark",
  diagMin: false
};

/* ============================================================
   Theme engine — dark · light · vivid
   ============================================================ */
const THEMES = ["dark","light","vivid"];
function setTheme(t, persist){
  if(THEMES.indexOf(t) < 0) t = "dark";
  S.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  document.querySelectorAll("#themeSeg button").forEach(b =>
    b.classList.toggle("on", b.dataset.theme === t));
  if(persist !== false) DB.set("theme", t);
}

/* ---- 4.1 selectors --------------------------------------- */
function locList(){
  return Object.keys(S.cfg.locations).sort();
}
function fillLocSelect(){
  const term = $("iTerm").value;
  const sel = $("iLoc"), cur = sel.value;
  sel.innerHTML = '<option value="">Select location…</option>';
  locList().forEach(id => {
    const L = S.cfg.locations[id];
    if(term && L.t !== term) return;
    const o = el("option", null, id + "  ·  " + L.open + "–" + L.close);
    o.value = id; sel.appendChild(o);
  });
  if(cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
  renderLanes();
}
function fillTerms(){
  const sel = $("iTerm"), t = [...new Set(locList().map(id => S.cfg.locations[id].t))].sort();
  sel.innerHTML = '<option value="">All terminals</option>';
  t.forEach(x => { const o = el("option", null, "Terminal " + x); o.value = x; sel.appendChild(o); });
}
function renderLanes(){
  const box = $("laneToggles"), id = $("iLoc").value;
  box.innerHTML = "";
  if(!id){ box.className = "hint"; box.textContent = "Select a location."; return; }
  box.className = "";
  const L = S.cfg.locations[id];
  L.mods.forEach((lanes, mi) => {
    const h = el("div", "hint", "Modset " + (mi+1) + (lanes.length === 1 ? "  (WTMD only — no Body Scanner)" : ""));
    h.style.margin = "6px 0 2px"; box.appendChild(h);
    lanes.forEach(l => {
      const lab = el("label", "chk");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = S.lanes[l.n] !== false;
      cb.onchange = () => { S.lanes[l.n] = cb.checked; };
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode("Lane " + l.n));
      if(l.ct){ const t = el("span", "tag ct", "CT · " + S.cfg.ctQual); t.style.marginLeft = "4px"; lab.appendChild(t); }
      box.appendChild(lab);
    });
  });
}

/* ---- 4.2 generation -------------------------------------- */
function currentWindow(){
  const id = $("iLoc").value; if(!id) return null;
  return sheetWindow(S.cfg, S.cfg.locations[id], $("iShift").value, $("iStart").value, $("iEnd").value);
}

function generate(newSeed){
  const locId = $("iLoc").value, date = $("iDate").value, shift = $("iShift").value;
  if(!locId) return toast("Select a location first.", "err");
  if(!S.roster.length) return toast("Upload a roster first.", "err");

  const loc = S.cfg.locations[locId];
  const win = sheetWindow(S.cfg, loc, shift, $("iStart").value, $("iEnd").value);
  if(!win.cols.length) return toast("That shift window produces no columns for this location.", "err");

  let people = staffFor(S.roster, locId, date, win.first, win.last + S.cfg.rules.slot, S.cfg, S.adj, shift);
  people = people.filter(p => !S.removed[p.k]);
  const titles = S.cfg.titles;
  const usable = people.filter(p => titles[p.ti] !== 0);
  const excluded = people.length - usable.length;
  if(!usable.length) return toast("No officers found for that location, date and shift.", "err");

  if(newSeed !== false) S.seed = (Math.random() * 1e9) | 0;

  /* seam import: pull the AM sheet's 11:00 assignment forward */
  let seamNote = null;
  if(shift === "PM"){
    const am = S.savedIndex && S.savedIndex[locId + "|" + date + "|AM"];
    if(am) seamNote = am;
  }

  /* officers added by hand join the pool before the solve */
  const extras = (S.extra || []).map(x => extraToPerson(x, win));
  const roster = usable.concat(extras);

  const res = solve(S.cfg, {
    locId, loc, shift, win, activeLanes: S.lanes,
    people: roster, seed: S.seed, locks: S.locks, modOverride: S.modOverride
  });
  if(res.error) return toast(res.error, "err");

  if(excluded) res.diag.unshift({ k:"i", m:`${excluded} roster row${excluded===1?"":"s"} excluded by job-title filter (Configuration → Job Titles in Rotation).` });
  if(shift === "PM" && seamNote)
    res.diag.unshift({ k:"i", m:`Seam: an AM sheet exists for this location and date. Crossover officers' 11:00 position and break counts were carried forward.` });
  else if(shift === "PM")
    res.diag.unshift({ k:"w", m:`Seam: no saved AM sheet for this location and date, so the PM sheet starts from a clean reset. Officers crossing 11:00 may receive an extra break.` });

  res.locId = locId; res.date = date; res.shift = shift;
  S.sheet = res;
  renderSheet();
  if(extras.length) res.diag.unshift({ k:"i", m:`${extras.length} officer${extras.length===1?"":"s"} added to this sheet by hand: ${esc(extras.map(p=>p.n).join(", "))}.` });
  ["bXlsx","bCsv","bPrint","bSave","bReroll","bResolve","bAdjust","bClearMan","bAddOfficer"].forEach(i => $(i).disabled = false);
  toast("Rotation generated — " + res.cols.length + " columns, " + roster.length + " officers.", "ok");
}

/* ---- 4.3 render ------------------------------------------ */
function modClass(m){ return "m" + (((Number(m) - 1) % 3) + 1); }

/* Convert a hand-added record into a solver-ready person. */
function extraToPerson(x, win){
  const slot = S.cfg.rules.slot;
  const w0 = win.first, w1 = win.last + slot;
  /* An officer pulled in from elsewhere carries that location's hours, which
     may not overlap this sheet at all (a PM row dropped onto an AM sheet).
     An empty intersection would render every cell off-shift and unclickable,
     so fall back to the whole sheet window — they are being reassigned here. */
  let s0 = x.s != null ? Math.max(x.s, w0) : w0;
  let e0 = x.e != null ? Math.min(x.e, w1) : w1;
  if(e0 - s0 < slot){ s0 = w0; e0 = w1; }
  return {
    k: x.k, n: x.n, ti: x.ti || "TSO", po: "", sex: x.sex || "M", quals: x.quals || "",
    s: s0, e: e0, rawS: s0, rawE: e0,
    abs: [], trn: [], notes: [x.src ? ("Added from " + x.src) : "Added manually"],
    restrict: null, pinned: false, mod: null, seat: null,
    preferMod: x.mod != null ? Number(x.mod) : null,
    added: 1, shift: ""
  };
}

function renderSheet(){
  const sh = S.sheet, wrap = $("sheetWrap");
  $("emptyState").style.display = "none";
  const old = document.getElementById("sheetTable"); if(old) old.remove();

  /* New logic to identify rows that are entirely off-shift */
  const isRowOff = (rk) => {
      if (!sh.grid[rk]) return false;
      for (const cell of sh.grid[rk]) {
          if (cell && cell.t !== 'off') return false;
      }
      return true;
  };

  const slot = S.cfg.rules.slot;
  const wEnd = sh.cols[sh.cols.length - 1] + slot;
  const posLabel = f => (S.cfg.positions.find(p => p.fam === f) || {}).label || f;

  /* ---------- print header ---------- */
  $("printHead").innerHTML =
    `<h1>${esc(sh.locId)} — ${esc(sh.shift)} Rotation</h1>` +
    `<div class="pl">${esc(sh.date || "(no date)")} &nbsp;·&nbsp; ${m2t(sh.cols[0])}–${m2t(wEnd)} ` +
    `&nbsp;·&nbsp; ${sh.people.length} officers &nbsp;·&nbsp; generated ${new Date().toLocaleString()}</div>`;
  $("printLegend").innerHTML =
    "<b>Legend:</b> " + [...new Set(sh.seats.map(s =>
      `${s.code} = ${posLabel(s.fam)}${s.laneN ? " (lane " + s.laneN + ")" : s.mod ? " (modset " + s.mod + ")" : ""}`))].join(" &nbsp;·&nbsp; ") +
    " &nbsp;·&nbsp; B = Break &nbsp;·&nbsp; TRN = Training &nbsp;·&nbsp; LV = Leave/Call-off &nbsp;·&nbsp; — = Unassigned";

  /* ---------- group officers by modset ---------- */
  const byMod = {};
  sh.people.forEach(p => {
    const key = (p.mod == null ? "?" : String(p.mod));
    (byMod[key] = byMod[key] || []).push(p);
  });
  const modKeys = Object.keys(byMod).sort((a, b) =>
    (a === "?" ? 99 : +a) - (b === "?" ? 99 : +b));

  /* lanes and seat codes owned by each modset */
  const laneOf = {}, codeOf = {};
  sh.seats.forEach(s => {
    if(s.laneN) (laneOf[s.mod] = laneOf[s.mod] || new Set()).add(s.laneN);
    (codeOf[s.mod] = codeOf[s.mod] || new Set()).add(s.code);
  });
  const laneText = m => {
    const l = [...(laneOf[m] || [])].sort((a, b) => a - b);
    return l.length ? ("Lane" + (l.length > 1 ? "s " : " ") + l.join(" & ")) : "no lanes";
  };

  /* ---------- modset legend strip ---------- */
  const lg = $("sheetLegend");
  lg.style.display = "flex"; lg.innerHTML = "";
  modKeys.filter(k => k !== "?").forEach(k => {
    const m = +k, codes = [...(codeOf[m] || [])];
    const t = el("span", "modtag");
    t.innerHTML = `<span class="sw" style="background:var(--${modClass(m)})"></span>` +
      `<b>Modset ${m}</b> · ${esc(laneText(m))} · ${codes.length} position${codes.length === 1 ? "" : "s"} · ` +
      `${byMod[k].length} officer${byMod[k].length === 1 ? "" : "s"}`;
    t.title = "Positions: " + codes.join(", ");
    lg.appendChild(t);
  });
  if(byMod["?"]){
    const t = el("span", "modtag");
    t.innerHTML = `<span class="sw" style="background:var(--tx3)"></span><b>Unassigned</b> · ${byMod["?"].length} officer(s)`;
    lg.appendChild(t);
  }

  /* ---------- table ---------- */
  const t = el("table", "sheet"); t.id = "sheetTable";
  const th = el("thead"), hr = el("tr");
  hr.appendChild(el("th", "hs h-tool", ""));
  hr.appendChild(el("th", "hs h-cert", "CERT?"));
  hr.appendChild(el("th", "hs h-name", "NAME"));
  hr.appendChild(el("th", "hs h-mod", "MOD"));
  sh.cols.forEach(c => hr.appendChild(el("th", null, m2hhmm(c))));
  th.appendChild(hr);

  /* ---- demand strip: lanes the projections call for, hour by hour ---- */
  const dem = laneDemand(sh, S.cfg, S.proj);
  sh.demand = dem;
  if(dem.has){
    const dr = el("tr", "demand");
    const lbl = el("th", "hs h-tool", ""); dr.appendChild(lbl);
    const l2 = el("th", "hs h-cert", "LANES REQ"); dr.appendChild(l2);
    const l3 = el("th", "hs h-name", "");
    l3.innerHTML = '<span style="font:600 10.5px var(--f);color:var(--tx3);text-transform:none;letter-spacing:0">' +
      'from projections · open vs required</span>';
    dr.appendChild(l3);
    dr.appendChild(el("th", "hs h-mod", ""));
    dem.perCol.forEach(c => {
      const cell = el("th", "dm");
      const short = c.need != null && c.open < c.need;
      const unstaffed = c.need != null && c.staffable < c.need;
      if(short) cell.classList.add("bad");
      else if(unstaffed) cell.classList.add("warn");
      else if(c.need != null) cell.classList.add("ok");
      cell.textContent = c.need == null ? "–" : String(c.need);
      cell.title = `${m2t(c.t)}–${m2t(c.t + S.cfg.rules.slot)}\n` +
        `Projected ${c.pax} passengers this hour\n` +
        `Lanes required ${c.need}${c.uncapped > c.physical ? " (demand says " + c.uncapped + ", only " + c.physical + " exist)" : ""}\n` +
        `Lanes open ${c.open} · staff supports ${c.staffable} (${c.onFloor} on the floor)`;
      dr.appendChild(cell);
    });
    th.appendChild(dr);
  }
  t.appendChild(th);

  const nCols = sh.cols.length + 4;
  const tb = el("tbody");

  modKeys.forEach((mk, mi) => {
    /* modset band */
    const band = el("tr", "band");
    const bc = el("td"); bc.colSpan = nCols;
    const known = mk !== "?";
    bc.innerHTML = `<span class="bandin">` +
      `<span class="bar" style="background:var(--${known ? modClass(mk) : "tx3"})"></span>` +
      (known
        ? `Modset ${esc(mk)}<span class="lanes">${esc(laneText(+mk))} · ${byMod[mk].length} officer${byMod[mk].length === 1 ? "" : "s"}${(codeOf[+mk] && !codeOf[+mk].has("SO" + mk)) ? " · no Body Scanner" : ""}</span>`
        : `Unassigned<span class="lanes">${byMod[mk].length} officer(s) with no modset</span>`) +
      `</span>`;
    band.appendChild(bc); tb.appendChild(band);

     byMod[mk].forEach((p, pi) => {
  const rk = p.k + "|" + p.s;
  const isOff = (sh.grid[rk] || []).every(cell => !cell || cell.t === "off"); /* ADD */
  const tr = el("tr", known ? modClass(mk) : "");
  if (isOff) tr.classList.add("off-row");                                    /* ADD */
  if(pi === byMod[mk].length - 1 && mi < modKeys.length - 1) tr.classList.add("mline");
  tr.dataset.rk = rk;


      const c0 = el("td", "tool");
      const btn = el("button", "rowclear");
      btn.title = "Clear every position on this row";
      btn.dataset.clear = rk;
      btn.innerHTML = '<svg class="ic sm"><use href="#i-eraser"/></svg>';
      c0.appendChild(btn); tr.appendChild(c0);

      const c1 = el("td", "cert", p.quals || "—");
      c1.title = "Qualifications: " + (p.quals || "none");
      tr.appendChild(c1);

      const c2 = el("td", "name");
      c2.dataset.rk = rk; c2.dataset.pk = p.k;
      const nm = el("span", "nm", p.n);
      nm.classList.add("editable");
      const sb = el("span", "sb", `${p.ti || "—"} · ${p.sex || "?"} · ${m2t(p.rawS)}–${m2t(p.rawE)}` +
        (p.added ? " · added" : "") + (p.restrict ? " · RESTRICTED" : "") + (p.pinned ? " · pinned" : ""));
      c2.appendChild(nm); c2.appendChild(sb);
      c2.title = `${p.n} · ${p.sex} · modset ${p.mod == null ? "—" : p.mod} · ${m2t(p.rawS)}–${m2t(p.rawE)}` +
        (p.restrict ? ` · RESTRICTED: ${p.restrict.join(", ")}` : "") +
        (p.notes && p.notes.length ? ` · ${p.notes.join("; ")}` : "");
      tr.appendChild(c2);

      const c3 = el("td", "modcol");
      c3.dataset.rk = rk; c3.dataset.pk = p.k;
      const chip = el("span", "modchip editable " + (known ? modClass(mk) : "mx"), known ? "M" + mk : "—");
      chip.title = known ? `Modset ${mk} — ${laneText(+mk)} — click to move this officer`
                         : "No modset assigned — click to place";
      c3.appendChild(chip); tr.appendChild(c3);

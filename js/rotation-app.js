"use strict";
/* ============================================================
   ROTATION BUILDER — fully offline single-file tool
   Section 1: constants, defaults, storage, utilities
   ============================================================ */

const APP_VER = "1.0.0";

/* ---- position families ---------------------------------- */
const DEF_POS = [
  { fam:"T",    label:"TDC",          scope:"lane", seats:1 },
  { fam:"D",    label:"Divest",       scope:"lane", seats:1 },
  { fam:"P",    label:"PSO",          scope:"lane", seats:1 },
  { fam:"X",    label:"X-ray",        scope:"lane", seats:1 },
  { fam:"SO",   label:"Body Scanner", scope:"mod",  seats:2 },
  { fam:"M",    label:"WTMD",         scope:"mod",  seats:1 },
  { fam:"KCM",  label:"KCM",          scope:"site", seats:1 },
  { fam:"EXIT", label:"Exit Lane",    scope:"site", seats:1 }
];

const DEF_QUALS = ["1","2","3","4","6","8","9","0","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","X","Z"];

/* ---- location catalogue (derived from supplied parameters) */
const L = (t,open,close,mods,kcm,exit)=>({t,open,close,mods,kcm:kcm||null,exit:exit||{am:0,pm:0}});
const lane = (n,ct)=>({n,ct:ct?1:0});

const DEF_LOCS = {
  "CKPT-A12": L("A","04:00","20:00",[[lane(1,1),lane(2,0)],[lane(3,0)]]),
  "CKPT-A20": L("A","03:30","20:00",[[lane(1,0),lane(2,0)]]),
  "CKPT-A21": L("A","03:00","22:30",[[lane(1,0),lane(2,0)],[lane(3,0),lane(4,0)]],{open:"03:00",close:"20:00"}),
  "CKPT-A35": L("A","04:30","20:00",[[lane(1,0),lane(2,0)],[lane(3,0)]]),
  "CKPT-B09": L("B","04:30","21:00",[[lane(1,1),lane(2,0)],[lane(3,0)]]),
  "CKPT-B30": L("B","04:30","22:45",[[lane(1,0),lane(2,0)],[lane(3,0)]],{open:"04:30",close:"19:00"}),
  "CKPT-C10": L("C","05:00","13:00",[[lane(1,0),lane(2,0)]],null,{am:1,pm:0}),
  "CKPT-C11": L("C","04:00","21:00",[[lane(1,0),lane(2,0)]],{open:"03:30",close:"21:00"},{am:0,pm:1}),
  "CKPT-C21": L("C","03:30","22:30",[[lane(1,0),lane(2,1)],[lane(3,0),lane(4,0)],[lane(5,0)]]),
  "CKPT-D18": L("D","04:00","23:00",[[lane(1,0),lane(2,0)],[lane(3,0)]],null,{am:1,pm:1}),
  "CKPT-D22": L("D","05:00","21:00",[[lane(1,0),lane(2,0)],[lane(3,1),lane(4,0)],[lane(5,0),lane(6,0)]],{open:"05:00",close:"21:00"}),
  "CKPT-D30": L("D","03:30","23:00",[[lane(1,0),lane(2,0)],[lane(3,0),lane(4,0)]],null,{am:1,pm:1}),
  "CKPT-E08": L("E","03:45","20:30",[[lane(1,0),lane(2,0)],[lane(3,0)]]),
  "CKPT-E16": L("E","04:00","20:00",[[lane(1,0),lane(2,0)]],{open:"04:00",close:"19:00"}),
  "CKPT-E18": L("E","03:00","23:00",[[lane(1,1),lane(2,0)],[lane(3,0),lane(4,0)]]),
  "CKPT-E33": L("E","04:00","20:30",[[lane(1,0),lane(2,0)]])
};

const DEF_TITLES = { TSO:1, LTSO:1, STSO:0, "Phase 1":1, "TSO/DFO":1, "TSO DFO":1, "LTSO/DFO":1, ESTI:1, CCO:0, SCCO:0, MSTI:0, PA:0, TSM:0, Officer:0, ETSO:0 };

const DEF_MAP = { id:"KronosID", name:"EmployeeName", title:"Job Title", posn:"Position",
                  loc:"Location", shift:"Shift", start:"Start", end:"End",
                  sex:"Sex", quals:"Quals", date:"Date", remarks:"Remarks" };

function defaultConfig(){
  return {
    v: APP_VER,
    rules: {
      slot: 30, seamAM: "11:00", seamPM: "11:30",
      femPerMod: 4, brkTarget: 1, brkMax: 2, brkHours: 6, laneMin: 5,
      allowRepeat: false, breakClears: true, femScale: true, pinSingle: true, strictShift: true,
      dropOrder: "M,X,D,P,EXIT,KCM,T,SO",
      ring: "M,SO-A,P-A,X-A,D-A,T-A,EXIT,SO-B,P-B,X-B,D-B,T-B,KCM"
    },
    positions: JSON.parse(JSON.stringify(DEF_POS)),
    quals: DEF_QUALS.slice(),
    qualMap: {},                    /* per-position quals; CT lanes handled by ctQual */
    ctQual: "Z",
    locations: JSON.parse(JSON.stringify(DEF_LOCS)),
    titles: Object.assign({}, DEF_TITLES),
    colmap: Object.assign({}, DEF_MAP),
    aliases: { "CKPT-NORTH":"" },
    proj: {
      mode: "standard",        /* standard | combined | separate */
      paxPerLane: 150,         /* standard-screening throughput, pax per lane per hour */
      prePerLane: 260,         /* PreCheck throughput per lane per hour */
      peakFactor: 1.0,         /* multiplier for within-the-hour surges */
      minLanes: 1,             /* lanes to keep open while the location is open */
      firstLaneStaff: 5,       /* officers to run one lane: TDC, Divest, X-ray, PSO, WTMD */
      extraLaneStaff: 3,       /* each additional lane in a modset: Divest, X-ray, PSO */
      warnAt: 1,               /* short by this many lanes before warning */
      colmap: { date:"Date", term:"Terminal", ckpt:"Checkpoint",
                metric:"Metrics", value:"Sum of Value", hour:"Hour of Day" },
      stdKey: "Standard", preKey: "PreCheck"
    },
    restrictions: {}
  };
}

/* ---- tiny IndexedDB wrapper ------------------------------ */
const DB = (()=>{
  let db=null;
  function open(){
    return new Promise((res,rej)=>{
      if(db) return res(db);
      const rq = indexedDB.open("rotationBuilder", 1);
      rq.onupgradeneeded = e => {
        const d = e.target.result;
        if(!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      };
      rq.onsuccess = e => { db = e.target.result; res(db); };
      rq.onerror = e => rej(e.target.error);
    });
  }
  function tx(mode){ return open().then(d => d.transaction("kv", mode).objectStore("kv")); }
  return {
    get(k){ return tx("readonly").then(s => new Promise((res,rej)=>{
      const r = s.get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
    set(k,v){ return tx("readwrite").then(s => new Promise((res,rej)=>{
      const r = s.put(v,k); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); })); },
    del(k){ return tx("readwrite").then(s => new Promise((res,rej)=>{
      const r = s.delete(k); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); })); },
    keys(){ return tx("readonly").then(s => new Promise((res,rej)=>{
      const r = s.getAllKeys(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); })); }
  };
})();

/* ---- time helpers ---------------------------------------- */
function t2m(t){
  if(t===null||t===undefined||t==="") return null;
  if(typeof t === "number"){ // excel fraction of a day
    if(t>0 && t<1) return Math.round(t*1440);
    return Math.round(t);
  }
  if(t instanceof Date) return t.getHours()*60 + t.getMinutes();
  const s = String(t).trim();
  let m = s.match(/^(\d{1,2}):(\d{2})/);
  if(m) return (+m[1])*60 + (+m[2]);
  m = s.match(/^(\d{1,2})(\d{2})$/);
  if(m) return (+m[1])*60 + (+m[2]);
  return null;
}
function m2t(m){
  if(m===null||m===undefined) return "";
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
}
function m2hhmm(m){ return m2t(m).replace(":",""); }
function snapDown(m,step){ return Math.floor(m/step)*step; }
function snapUp(m,step){ return Math.ceil(m/step)*step; }
function ovl(a1,a2,b1,b2){ return a1 < b2 && b1 < a2; }

function dkey(d){
  if(!d) return "";
  if(d instanceof Date && !isNaN(d)){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  const s = String(d).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+"-"+m[2]+"-"+m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return m[3]+"-"+String(+m[1]).padStart(2,"0")+"-"+String(+m[2]).padStart(2,"0");
  const p = new Date(s);
  return isNaN(p) ? "" : dkey(p);
}
function todayKey(){ return dkey(new Date()); }

/* ---- location normalisation ------------------------------ */
function normLoc(raw, cfg){
  if(raw===null||raw===undefined) return "";
  let s = String(raw).trim().toUpperCase().replace(/\s+/g," ");
  if(cfg && cfg.aliases){
    for(const k in cfg.aliases){
      if(k.toUpperCase() === s) return cfg.aliases[k];
    }
  }
  const m = s.match(/^CKPT[\s\-_]*([A-E])[\s\-_]*0*(\d{1,3})\s*$/);
  if(m) return "CKPT-" + m[1] + String(+m[2]).padStart(2,"0");
  return s;
}

/* ---- misc ------------------------------------------------ */
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function $(id){ return document.getElementById(id); }
function el(tag, cls, txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function uid(){ return Math.random().toString(36).slice(2,10); }

/* seeded PRNG (mulberry32) — same seed ⇒ same sheet */
function rng(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

let TOAST_T = null;
function toast(msg, kind){
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast on" + (kind ? " "+kind : "");
  clearTimeout(TOAST_T);
  TOAST_T = setTimeout(()=>{ t.className = "toast" + (kind?" "+kind:""); }, 2600);
}
function confirmBox(title, body, onOk){
  $("cfTitle").textContent = title;
  $("cfBody").innerHTML = body;
  const ov = $("ovConfirm");
  ov.classList.add("on");
  const btn = $("bCfOk");
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.onclick = ()=>{ ov.classList.remove("on"); onOk(); };
}
/* ============================================================
   Section 2: roster ingestion + remarks parsing
   ============================================================ */

const RX_RANGE = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/g;

function grabRanges(s){
  const out = []; RX_RANGE.lastIndex = 0; let m;
  while((m = RX_RANGE.exec(s))){
    const a = (+m[1])*60 + (+m[2]);
    let b = (+m[3])*60 + (+m[4]);
    if(b <= a) b += 1440;                    /* window crosses midnight */
    out.push([a,b]);
  }
  return out;
}

/**
 * Interpret the Remarks cell.
 * Returns { drop, absent:[[a,b]…], train:[[a,b]…], notes:[…] }
 *   drop  – row is a traded-away shift and must be excluded entirely
 *   absent– leave / call-off windows (blank = whole row window)
 *   train – training windows (officer is off the floor, own code)
 * SCHED OT, ALSO … and SECOND SHIFT are informational: the row's own
 * Start/End is authoritative, and other placements have their own rows.
 */
function parseRemarks(raw){
  const res = { drop:false, absent:[], train:[], notes:[] };
  if(!raw) return res;
  const segs = String(raw).split(";").map(s => s.trim()).filter(Boolean);
  for(const seg of segs){
    const u = seg.toUpperCase();
    if(/\(STO\)/.test(u) || /^SHIFT\s+TRADED\s+AWAY/.test(u)){ res.drop = true; res.notes.push("Shift traded away"); continue; }
    if(/\(STW\)/.test(u) || /^SHIFT\s+TRADE\b/.test(u)){ res.notes.push("Shift trade (working)"); continue; }
    if(/^TRAINING\b/.test(u) || /\bAT\s+TRAINING\b/.test(u)){
      const r = grabRanges(seg);
      if(/^TRAINING\b/.test(u)){ r.length ? res.train.push(...r) : res.train.push(null); res.notes.push("Training"); }
      else res.notes.push("Also at training");
      continue;
    }
    if(/^LEAVE\s*:/.test(u)){
      const sub = (u.match(/^LEAVE\s*:\s*([A-Z\-\s]+?)(?:\s+\d{1,2}:\d{2}|$)/) || [,"LEAVE"])[1].trim();
      const r = grabRanges(seg);
      r.length ? res.absent.push(...r) : res.absent.push(null);   /* null = whole shift */
      res.notes.push("Leave: " + sub.toLowerCase());
      continue;
    }
    if(/^CALL\s*OFF/.test(u)){
      const r = grabRanges(seg);
      r.length ? res.absent.push(...r) : res.absent.push(null);
      res.notes.push("Call off");
      continue;
    }
    if(/^SCHED(ULED)?\s*OT/.test(u)){ res.notes.push("Scheduled OT"); continue; }
    if(/^SECOND\s+SHIFT/.test(u)){ res.notes.push("Second shift"); continue; }
    if(/^ALSO\b/.test(u)){ res.notes.push("Also elsewhere"); continue; }
    res.notes.push(seg);
  }
  return res;
}

/* ---- header discovery ------------------------------------ */
function findHeaderRow(rows, want){
  const targets = Object.values(want).map(v => String(v).toLowerCase().trim());
  let best = -1, bestHits = 0;
  for(let i=0; i<Math.min(rows.length, 15); i++){
    const cells = (rows[i]||[]).map(c => String(c==null?"":c).toLowerCase().trim());
    let hits = 0;
    for(const t of targets) if(t && cells.includes(t)) hits++;
    if(hits > bestHits){ bestHits = hits; best = i; }
  }
  return { idx: best, hits: bestHits };
}

/**
 * Parse an uploaded workbook into normalised roster rows.
 * Only the mapped columns are read; any extra columns are ignored.
 */
function ingestWorkbook(ab, cfg){
  const wb = XLSX.read(ab, { type:"array", cellDates:true, cellText:false });
  const out = { rows:[], sheet:"", headers:[], missing:[], soft:[], unknownQuals:{}, locsSeen:{}, dates:{}, noId:false };
  let rows = null;

  for(const nm of wb.SheetNames){
    const r = XLSX.utils.sheet_to_json(wb.Sheets[nm], { header:1, raw:true, defval:null, blankrows:false });
    if(!r.length) continue;
    const h = findHeaderRow(r, cfg.colmap);
    if(h.hits >= 4){ rows = r; out.sheet = nm; out.hdrIdx = h.idx; break; }
    if(!rows){ rows = r; out.sheet = nm; out.hdrIdx = h.idx < 0 ? 0 : h.idx; }
  }
  if(!rows) throw new Error("No readable worksheet found in that file.");

  const hdr = (rows[out.hdrIdx] || []).map(c => String(c==null?"":c).trim());
  out.headers = hdr.slice();
  const low = hdr.map(s => s.toLowerCase());
  const col = {};
  for(const key in cfg.colmap){
    const want = String(cfg.colmap[key]).toLowerCase().trim();
    let i = low.indexOf(want);
    if(i < 0) i = low.findIndex(c => c && (c.replace(/[\s_]/g,"") === want.replace(/[\s_]/g,"")));
    col[key] = i;
    if(i < 0 && ["name","loc","start","end"].includes(key)) out.missing.push(cfg.colmap[key]);
    else if(i < 0) out.soft.push(cfg.colmap[key]);
  }
  if(out.missing.length) throw new Error("Missing required column(s): " + out.missing.join(", ") + ". Check Column Mapping in Configuration.");

  out.noId = col.id < 0;

  const known = new Set(cfg.quals.map(q => String(q).toUpperCase()));
  const get = (r,k) => col[k] >= 0 ? r[col[k]] : null;

  for(let i = out.hdrIdx + 1; i < rows.length; i++){
    const r = rows[i]; if(!r || !r.length) continue;
    const nm = get(r,"name"); if(!nm) continue;

    const locRaw = get(r,"loc");
    const lo = normLoc(locRaw, cfg);
    if(!/^CKPT-/.test(lo)) continue;                      /* checkpoints only — BAG etc. dropped */

    const s = t2m(get(r,"start")), e0 = t2m(get(r,"end"));
    if(s === null || e0 === null) continue;
    const e = e0 <= s ? e0 + 1440 : e0;

    const q = String(get(r,"quals") || "").toUpperCase().replace(/^DUAL[\s\-]*/,"").replace(/\s+/g,"");
    const qs = [];
    for(const ch of q){
      if(known.has(ch)) { if(!qs.includes(ch)) qs.push(ch); }
      else if(/[A-Z0-9]/.test(ch)) out.unknownQuals[ch] = (out.unknownQuals[ch]||0)+1;
    }

    const rem = parseRemarks(get(r,"remarks"));
    if(rem.drop) continue;                                 /* shift traded away */

    const d = dkey(get(r,"date"));
    const row = {
      k: String(get(r,"id") || nm).trim(),
      n: String(nm).trim(),
      ti: String(get(r,"title") || "").trim(),
      po: String(get(r,"posn") || "").trim(),
      lo, d,
      sh: String(get(r,"shift") || "").trim().toUpperCase(),
      s, e,
      x: String(get(r,"sex") || "").trim().toUpperCase().charAt(0),
      q: qs.join(""),
      ab: rem.absent, tr: rem.train, nt: rem.notes
    };
    out.rows.push(row);
    out.locsSeen[lo] = (out.locsSeen[lo]||0)+1;
    if(d) out.dates[d] = (out.dates[d]||0)+1;
  }
  if(!out.rows.length) throw new Error("No checkpoint rows found. Verify the Location column and that the file contains CKPT- entries.");
  return out;
}

/* ============================================================
   Section 2b: passenger projections → lane demand
   ============================================================ */

/* Projection files name checkpoints bare ("A21"), the rest of the tool
   uses canonical IDs ("CKPT-A21"). Accept either. */
function normProjLoc(raw, cfg){
  if(raw == null) return "";
  const s = String(raw).trim().toUpperCase();
  const direct = normLoc(s, cfg);
  if(/^CKPT-/.test(direct)) return direct;
  const m = s.match(/^([A-E])[\s\-_]*0?(\d{1,3})$/);
  if(m) return "CKPT-" + m[1] + String(+m[2]).padStart(2, "0");
  return direct;
}

function projHour(v){
  if(v == null) return null;
  if(v instanceof Date) return v.getHours();
  if(typeof v === "number") return v < 1 ? Math.round(v * 24) : Math.floor(v);
  const m = String(v).trim().match(/^(\d{1,2})/);
  return m ? +m[1] : null;
}

/**
 * Parse a projections workbook into
 *   { "CKPT-A21|2026-08-20": { 3:{std,pre}, 4:{std,pre}, … } }
 * Metric names are matched loosely so "Standard Projection",
 * "Std Projection" and "STANDARD" all land in the same bucket.
 */
function ingestProjections(ab, cfg){
  const P = cfg.proj, cm = P.colmap;
  const wb = XLSX.read(ab, { type:"array", cellDates:true, cellText:false });
  const out = { data:{}, rows:0, locs:{}, dates:{}, metrics:{}, unmatched:{} };
  let rows = null, hdrIdx = 0;

  for(const nm of wb.SheetNames){
    const r = XLSX.utils.sheet_to_json(wb.Sheets[nm], { header:1, raw:true, defval:null, blankrows:false });
    if(!r.length) continue;
    const h = findHeaderRow(r, cm);
    if(h.hits >= 4){ rows = r; hdrIdx = h.idx; break; }
    if(!rows){ rows = r; hdrIdx = Math.max(0, h.idx); }
  }
  if(!rows) throw new Error("No readable worksheet in that projections file.");

  const hdr = (rows[hdrIdx] || []).map(c => String(c == null ? "" : c).trim().toLowerCase());
  const col = {};
  for(const k in cm){
    const want = String(cm[k]).trim().toLowerCase();
    let i = hdr.indexOf(want);
    if(i < 0) i = hdr.findIndex(c => c && c.replace(/[\s_]/g,"") === want.replace(/[\s_]/g,""));
    col[k] = i;
  }
  const missing = ["ckpt","value","hour"].filter(k => col[k] < 0).map(k => cm[k]);
  if(missing.length) throw new Error("Projections file is missing column(s): " + missing.join(", ") +
    ". Set the names under Configuration → Passenger Projections.");

  const stdRx = new RegExp(P.stdKey.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "i");
  const preRx = new RegExp(P.preKey.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "i");

  for(let i = hdrIdx + 1; i < rows.length; i++){
    const r = rows[i]; if(!r || !r.length) continue;
    const lo = normProjLoc(r[col.ckpt], cfg);
    if(!/^CKPT-/.test(lo)) continue;
    const hr = projHour(r[col.hour]);
    if(hr == null) continue;
    const val = Number(r[col.value]);
    if(!isFinite(val)) continue;
    const dk = col.date >= 0 ? dkey(r[col.date]) : "";
    const metric = col.metric >= 0 ? String(r[col.metric] || "").trim() : "";

    const key = lo + "|" + dk;
    const slot = (out.data[key] = out.data[key] || {});
    const cell = (slot[hr] = slot[hr] || { std:0, pre:0 });
    if(preRx.test(metric)) cell.pre += val;
    else if(stdRx.test(metric) || !metric) cell.std += val;
    else { out.unmatched[metric] = (out.unmatched[metric] || 0) + 1; cell.std += val; }

    out.rows++;
    out.locs[lo] = (out.locs[lo] || 0) + 1;
    if(dk) out.dates[dk] = (out.dates[dk] || 0) + 1;
    if(metric) out.metrics[metric] = (out.metrics[metric] || 0) + 1;
  }
  if(!out.rows) throw new Error("No usable projection rows found — check the Checkpoint column.");
  return out;
}

/* Lanes needed for one hour's passenger count. */
function lanesFor(cell, cfg){
  const P = cfg.proj;
  const std = (cell && cell.std) || 0, pre = (cell && cell.pre) || 0;
  const f = P.peakFactor || 1;
  let need;
  if(P.mode === "combined")      need = Math.ceil(((std + pre) * f) / Math.max(1, P.paxPerLane));
  else if(P.mode === "separate") need = Math.ceil((std * f) / Math.max(1, P.paxPerLane)) +
                                        Math.ceil((pre * f) / Math.max(1, P.prePerLane));
  else                           need = Math.ceil((std * f) / Math.max(1, P.paxPerLane));
  return { need, std, pre, pax: P.mode === "standard" ? std : std + pre };
}

/* How many lanes a given headcount can actually run. */
function staffableLanes(n, cfg){
  const P = cfg.proj;
  const a = Math.max(1, P.firstLaneStaff || 5), b = Math.max(1, P.extraLaneStaff || 3);
  if(n < a) return 0;
  return 1 + Math.floor((n - a) / b);
}

/**
 * Per-column lane demand for the sheet on screen.
 * Returns one entry per time column, plus an hour-level roll-up.
 */
function laneDemand(sh, cfg, projStore){
  const key = sh.locId + "|" + (sh.date || "");
  const table = (projStore && (projStore[key] || projStore[sh.locId + "|"])) || null;
  const slot = cfg.rules.slot;
  const openLanes = new Set(sh.seats.filter(s => s.laneN).map(s => s.laneN));
  const physical = (cfg.locations[sh.locId].mods || []).reduce((n, m) => n + m.length, 0);

  const perCol = sh.cols.map((t, ci) => {
    const hr = Math.floor((t % 1440) / 60);
    const cell = table ? table[hr] : null;
    const L = lanesFor(cell, cfg);
    const onFloor = sh.people.filter(p =>
      presentAt(p, t, slot) === "on" && (p.breaks || []).indexOf(ci) < 0).length;
    const need = table ? Math.max(cfg.proj.minLanes || 0, Math.min(L.need, physical)) : null;
    return { ci, t, hr, pax: L.pax, std: L.std, pre: L.pre,
             need, uncapped: table ? L.need : null,
             open: openLanes.size, staffable: staffableLanes(onFloor, cfg),
             onFloor, physical };
  });

  const hours = {};
  perCol.forEach(c => {
    const h = hours[c.hr] = hours[c.hr] || { hr:c.hr, pax:c.pax, need:c.need, uncapped:c.uncapped,
                                             open:c.open, staffable:c.staffable, physical:c.physical,
                                             from:c.t, to:c.t + slot };
    h.to = c.t + slot;
    h.staffable = Math.min(h.staffable, c.staffable);
    h.onFloor = Math.min(h.onFloor == null ? c.onFloor : h.onFloor, c.onFloor);
  });
  return { perCol, hours: Object.values(hours).sort((a,b) => a.from - b.from), has: !!table, key };
}

/**
 * Build the working staff list for one sheet: everyone whose row window
 * overlaps the sheet window at this location on this date.
 */
function staffFor(roster, loc, date, w0, w1, cfg, adj, shift){
  const out = [];
  const seen = {};
  /* Strict shift matching: an AM sheet shows AM officers only, a PM sheet PM
     only. Without this an AM officer working past 11:00 lands on the PM sheet
     just because the clock overlaps. Rows with a blank Shift are always kept. */
  const want = String(shift || "").toUpperCase();
  for(const r of roster){
    if(r.lo !== loc) continue;
    if(date && r.d && r.d !== date) continue;
    if(cfg.rules.strictShift !== false && want && r.sh && r.sh !== want) continue;
    const s = Math.max(r.s, w0), e = Math.min(r.e, w1);
    if(e - s < cfg.rules.slot) continue;

    const a = adj && adj[r.k] ? adj[r.k] : null;
    if(a && a.out) continue;

    /* absence windows (null = whole row window) */
    const abs = [];
    for(const w of r.ab) abs.push(w === null ? [r.s, r.e] : w);
    if(a && a.absent) for(const w of a.absent) abs.push(w);

    const trn = [];
    for(const w of r.tr) trn.push(w === null ? [r.s, r.e] : w);
    if(a && a.train) for(const w of a.train) trn.push(w);

    /* fully absent across the whole visible window? drop from the sheet */
    let covered = true;
    for(let t = s; t < e; t += cfg.rules.slot){
      let hit = false;
      for(const w of abs) if(t >= w[0] && t < w[1]) { hit = true; break; }
      if(!hit){ covered = false; break; }
    }
    if(covered && abs.length) continue;

    const key = r.k + "|" + r.s + "|" + r.e;
    if(seen[key]) continue;
    seen[key] = 1;

    const rest = (cfg.restrictions && cfg.restrictions[r.k]) || (a && a.restrict ? { allow:a.restrict } : null);

    out.push({
      k: r.k, n: r.n, ti: r.ti, po: r.po, sex: r.x, quals: r.q,
      s, e, rawS: r.s, rawE: r.e,
      abs, trn, notes: r.nt.slice(),
      restrict: rest && rest.allow && rest.allow.length ? rest.allow.slice() : null,
      pinned: false, mod: null, seat: null,
      preferMod: null,
      shift: r.sh || ""
    });
  }
      /* rank order: TSO -> essential LTSO -> other LTSO, then surname */
  let essentialQuals = [];
  try {
    const gv = id => { const e = document.getElementById(id); return e ? e.value : ""; };
    const shiftVal = gv("iShift") || "AM";
    const win = sheetWindow(cfg, cfg.locations[loc], shiftVal, gv("iStart"), gv("iEnd"));
    const activeLanes = (typeof S !== "undefined" && S.lanes) ? S.lanes : {};
    const seats = buildSeats(cfg, loc, cfg.locations[loc], shiftVal, win, activeLanes);
    
    const reqQuals = new Set();
    for (const seat of seats) {
      const r = cfg.qualMap && cfg.qualMap[seat.fam];
      if (r) for (const q of r) reqQuals.add(q);
      if (seat.ct && cfg.ctQual) reqQuals.add(cfg.ctQual);
    }

    const tsoQuals = new Set(
      out.filter(p => !p.ti.toUpperCase().startsWith("LTSO") && !p.ti.toUpperCase().startsWith("STSO"))
         .flatMap(p => (p.quals || "").split(""))
    );
    essentialQuals = [...reqQuals].filter(q => !tsoQuals.has(q));
  } catch (err) {
    console.warn("Seeding qualification order fallback failed", err);
  }

  const rankOf = p => {
    const t = p.ti.toUpperCase();
    if (!t.startsWith("LTSO") && !t.startsWith("STSO")) return 1; // TSO = highest priority
    if (essentialQuals.some(q => (p.quals || "").includes(q))) return 2; // Essential LTSO
    return 3; // Non-essential LTSO
  };

  out.sort((a,b) => rankOf(a) - rankOf(b) || a.n.localeCompare(b.n));
  return out;
}

/* ============================================================
   Section 3: rotation engine
   ============================================================ */

/* ---- 3.1 sheet window ------------------------------------ */
function sheetWindow(cfg, loc, shift, ovStart, ovEnd){
  const st = cfg.rules.slot;
  const seamA = t2m(cfg.rules.seamAM), seamP = t2m(cfg.rules.seamPM);
  let open = t2m(ovStart) != null ? t2m(ovStart) : t2m(loc.open);
  let close = t2m(ovEnd) != null ? t2m(ovEnd) : t2m(loc.close);
  if(close <= open) close += 1440;
  open = snapDown(open, st); close = snapUp(close, st);

  let first, last;
  if(shift === "AM"){ first = open; last = Math.min(seamA, close - st); }
  else { first = Math.max(seamP, open); last = close - st; }
  if(last < first) return { cols:[], first, last, open, close };

  const cols = [];
  for(let t = first; t <= last; t += st) cols.push(t);
  return { cols, first, last, open, close };
}

/* ---- 3.2 seat construction ------------------------------- */
function buildSeats(cfg, locId, loc, shift, win, activeLanes){
  const seats = [], famOf = {};
  cfg.positions.forEach(p => famOf[p.fam] = p);
  const c0 = win.cols[0], c1 = win.cols[win.cols.length-1] + cfg.rules.slot;

  loc.mods.forEach((lanes, mi) => {
    const mod = mi + 1;
    const on = lanes.filter(l => activeLanes[l.n] !== false);
    if(!on.length) return;

    if(famOf.M) seats.push({ id:"M"+mod, code:"M"+mod, fam:"M", mod, laneN:null, ct:0, sub:null, t0:c0, t1:c1 });
    if(on.length >= 2 && famOf.SO){
      seats.push({ id:"SO"+mod+"-A", code:"SO"+mod, fam:"SO", mod, laneN:null, ct:0, sub:"A", t0:c0, t1:c1 });
      seats.push({ id:"SO"+mod+"-B", code:"SO"+mod, fam:"SO", mod, laneN:null, ct:0, sub:"B", t0:c0, t1:c1 });
    }
    on.forEach(l => {
      ["T","D","P","X"].forEach(f => {
        if(!famOf[f]) return;
        seats.push({ id:f+l.n, code:f+l.n, fam:f, mod, laneN:l.n, ct:l.ct, sub:null, t0:c0, t1:c1 });
      });
    });
  });

  const firstMod = loc.mods.findIndex(ls => ls.some(l => activeLanes[l.n] !== false)) + 1;
  if(firstMod > 0){
    const wantExit = loc.exit && loc.exit[shift === "AM" ? "am" : "pm"];
    if(wantExit && famOf.EXIT) seats.push({ id:"EXIT", code:"EXIT", fam:"EXIT", mod:firstMod, laneN:null, ct:0, sub:null, t0:c0, t1:c1 });
    if(loc.kcm && famOf.KCM){
      let k0 = t2m(loc.kcm.open), k1 = t2m(loc.kcm.close);
      if(k1 <= k0) k1 += 1440;
      const a = Math.max(k0, c0), b = Math.min(k1, c1);
      if(b > a) seats.push({ id:"KCM", code:"KCM", fam:"KCM", mod:firstMod, laneN:null, ct:0, sub:null, t0:a, t1:b });
    }
  }
  return seats;
}

/* ---- 3.3 ring order per modset --------------------------- */
function buildRings(cfg, loc, seats, activeLanes){
  const tokens = String(cfg.rules.ring).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const byId = {}; seats.forEach(s => byId[s.id] = s);
  const rings = {};

  loc.mods.forEach((lanes, mi) => {
    const mod = mi + 1;
    const on = lanes.filter(l => activeLanes[l.n] !== false);
    if(!on.length) return;
    const A = on[0] ? on[0].n : null, B = on[1] ? on[1].n : null;
    const ring = [];
    for(const tk of tokens){
      let id = null;
      if(tk === "M") id = "M" + mod;
      else if(tk === "SO-A") id = "SO" + mod + "-A";
      else if(tk === "SO-B") id = "SO" + mod + "-B";
      else if(tk === "EXIT") id = "EXIT";
      else if(tk === "KCM") id = "KCM";
      else {
        const m = tk.match(/^([A-Z]+)-([AB])$/);
        if(m){
          const n = m[2] === "A" ? A : B;
          if(n != null) id = m[1] + n;
        } else if(byId[tk]) id = tk;
      }
      if(id && byId[id] && byId[id].mod === mod && ring.indexOf(id) < 0) ring.push(id);
    }
    /* safety net: any seat in this mod not covered by the ring string */
    seats.filter(s => s.mod === mod && ring.indexOf(s.id) < 0).forEach(s => ring.push(s.id));
    rings[mod] = ring;
  });
  return rings;
}

/* ---- 3.4 eligibility ------------------------------------- */
function seatAllows(cfg, p, seat){
  if(p.restrict){
    const ok = p.restrict.some(r => r === seat.id || r === seat.code || r === seat.fam);
    if(!ok) return false;
  }
  if(seat.ct && ["T","D","P","X"].includes(seat.fam)){
    if(cfg.ctQual && p.quals.indexOf(cfg.ctQual) < 0) return false;
  }
  const req = cfg.qualMap && cfg.qualMap[seat.fam];
  if(req && req.length){
    for(const q of req) if(p.quals.indexOf(q) < 0) return false;
  }
  return true;
}

function presentAt(p, t, slot){
  if(t < p.s || t >= p.e) return "off";
  for(const w of p.abs) if(t >= w[0] && t < w[1]) return "lv";
  for(const w of p.trn) if(t >= w[0] && t < w[1]) return "trn";
  return "on";
}

/* ---- 3.5 break scheduling -------------------------------- */
function scheduleBreaks(cfg, people, cols, seatsByMod, diag){
  const st = cfg.rules.slot, R = cfg.rules;
  const nCols = cols.length;
  const lanesInMod = {};
  for(const m in seatsByMod) lanesInMod[m] = new Set(seatsByMod[m].filter(s => s.laneN).map(s => s.laneN)).size || 1;

  const load = {};   /* mod -> colIdx -> count */
  for(const m in seatsByMod){ load[m] = new Array(nCols).fill(0); }

  const order = people.slice().sort((a,b) => (a.e - a.s) - (b.e - b.s) || a.s - b.s);
  for(const p of order){
    p.breaks = [];
    if(p.mod == null) continue;
    const hrs = (p.e - p.s) / 60;
    const want = hrs >= R.brkHours ? 2 : 1;

    /* eligible columns: on the floor, not the first or last slot of the sheet,
       and not the officer's own first or last slot */
    const elig = [];
    for(let i = 0; i < nCols; i++){
      const t = cols[i];
      if(i === 0 || i === nCols - 1) continue;
      if(presentAt(p, t, st) !== "on") continue;
      if(t < p.s + st || t >= p.e - st) continue;
      elig.push(i);
    }
    if(!elig.length) continue;

    const cap = lanesInMod[p.mod] || 1;
    const softCap = cap * R.brkTarget, hardCap = cap * R.brkMax;
    const picks = [];
    for(let b = 0; b < want; b++){
      const ideal = elig[Math.floor(elig.length * (b + 1) / (want + 1))];
      let best = -1, bestScore = Infinity;
      for(const i of elig){
        if(picks.some(x => Math.abs(x - i) < 2)) continue;      /* keep breaks apart */
        const cur = load[p.mod][i];
        if(cur >= hardCap) continue;
        const score = Math.abs(i - ideal) + (cur >= softCap ? nCols : 0);
        if(score < bestScore){ bestScore = score; best = i; }
      }
      if(best < 0){ diag.push({ k:"w", m:`No break slot available for <b>${esc(p.n)}</b> (break ${b+1} of ${want}) — modset ${p.mod} at capacity.` }); continue; }
      load[p.mod][best]++;
      picks.push(best);
      if(load[p.mod][best] > softCap)
        diag.push({ k:"i", m:`Modset ${p.mod} at ${m2t(cols[best])}: ${load[p.mod][best]} officers on break (target ${softCap}) — required to deliver all breaks.` });
    }
    picks.sort((a,b)=>a-b);
    p.breaks = picks;
  }
}

/* ---- 3.6 main solver ------------------------------------- */
function solve(cfg, ctx){
  const { locId, loc, shift, win, activeLanes, people, seed, locks } = ctx;
  const st = cfg.rules.slot, R = cfg.rules;
  const cols = win.cols, nCols = cols.length;
  const diag = [];
  const rnd = rng(seed);

  const seats = buildSeats(cfg, locId, loc, shift, win, activeLanes);
  if(!seats.length) return { error:"No active lanes for this location and shift.", diag, seats:[], cols, grid:{} };
  const rings = buildRings(cfg, loc, seats, activeLanes);
  const byId = {}; seats.forEach(s => byId[s.id] = s);
  const seatsByMod = {};
  seats.forEach(s => (seatsByMod[s.mod] = seatsByMod[s.mod] || []).push(s));
  const mods = Object.keys(seatsByMod).map(Number).sort((a,b)=>a-b);

  /* fill priority: earlier family = filled first = dropped last */
  const dropOrder = String(R.dropOrder).split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const prio = s => {
    let i = dropOrder.indexOf(s.fam);
    if(i < 0) i = dropOrder.length;
    return i * 100 + (s.laneN || 0) * 2 + (s.sub === "B" ? 1 : 0);
  };
  const seatsRanked = seats.slice().sort((a,b) => prio(a) - prio(b));

  /* ---- 3.6.1 assign officers to modsets ------------------ */
  const cap = {}; mods.forEach(m => cap[m] = seatsByMod[m].length);
  const pinned = [];
  people.forEach(p => { p.mod = null; p.slot = null; p.pinned = false; p.pinSeat = null; p.breaks = []; });
  /* a modset the supervisor set by hand outranks the balancer */
  const modOv = ctx.modOverride || {};
  people.forEach(p => { if(modOv[p.k] != null) p.preferMod = Number(modOv[p.k]); });

  /* restricted officers pin to the mod that owns their allowed seat */
  people.filter(p => p.restrict).forEach(p => {
    const hit = seatsRanked.find(s => seatAllows(cfg, p, s));
    if(hit){ p.mod = hit.mod; p.pinned = true; p.pinSeat = hit.id; pinned.push(p); }
    else diag.push({ k:"e", m:`<b>${esc(p.n)}</b> has restrictions that no active position satisfies — placed manually or left unassigned.` });
  });

  const free0 = shuffle(people.filter(p => !p.pinned), rnd);
  const bins = {}; mods.forEach(m => bins[m] = []);
  /* an officer added by hand may request a specific modset */
  const free = [];
  for(const p of free0){
    if(p.preferMod != null && bins[p.preferMod]) bins[p.preferMod].push(p);
    else free.push(p);
  }
  /* balance by seat capacity, keeping a mix of sexes in every modset */
  const fem = free.filter(p => p.sex === "F"), mal = free.filter(p => p.sex !== "F");
  const needFem = m => (seatsByMod[m].some(s => s.fam === "SO") ? R.femPerMod : 0);
  mods.forEach(m => { for(let i = 0; i < needFem(m) && fem.length; i++) bins[m].push(fem.shift()); });
  const rest = shuffle(fem.concat(mal), rnd);
  let guard = 0;
  while(rest.length && guard++ < 100000){
    let target = mods[0], bestGap = -Infinity;
    for(const m of mods){
      const used = bins[m].length + pinned.filter(p => p.mod === m).length;
      const gap = cap[m] - used;
      if(gap > bestGap){ bestGap = gap; target = m; }
    }
    bins[target].push(rest.shift());
  }
  mods.forEach(m => bins[m].forEach(p => p.mod = m));

  /* sole-female pinning at Body Scanner */
  if(R.pinSingle){
    mods.forEach(m => {
      const so = seatsByMod[m].filter(s => s.fam === "SO");
      if(!so.length) return;
      const f = people.filter(p => p.mod === m && p.sex === "F" && !p.pinned);
      if(f.length === 1){
        f[0].pinned = true; f[0].pinSeat = so[1] ? so[1].id : so[0].id;
        diag.push({ k:"w", m:`Modset ${m}: <b>${esc(f[0].n)}</b> is the only female officer, so she is pinned to ${so[0].code} for the shift. Unpin by editing any cell.` });
      }
    });
  }

  /* ring slot for every unpinned officer */
  mods.forEach(m => {
    const ring = rings[m] || [];
    const grp = people.filter(p => p.mod === m && !p.pinned);
    /* interleave sexes so the two Body Scanner seats tend to land mixed */
    const f = grp.filter(p => p.sex === "F"), o = grp.filter(p => p.sex !== "F");
    const mix = []; let fi = 0, oi = 0;
    while(fi < f.length || oi < o.length){ if(fi < f.length) mix.push(f[fi++]); if(oi < o.length) mix.push(o[oi++]); }
    mix.forEach((p, i) => p.slot = ring.length ? i % ring.length : 0);
  });

  scheduleBreaks(cfg, people, cols, seatsByMod, diag);

  /* ---- 3.6.2 per-column assignment ----------------------- */
  const grid = {};                     /* personKey -> [cell per column] */
  people.forEach(p => grid[p.k + "|" + p.s] = new Array(nCols).fill(null));
  /* prevSeat holds the printed position CODE, not the internal seat id:
     SO1-A and SO1-B are two seats at one Body Scanner, so moving between
     them is staying put and must count as a consecutive repeat. */
  const prevSeat = {};
  const codeOf = id => (byId[id] ? byId[id].code : id);
  const surplusCols = [], unmanned = {}, forced = {};

  for(let c = 0; c < nCols; c++){
    const t = cols[c];
    const active = seats.filter(s => t >= s.t0 && t < s.t1);
    const activeIds = new Set(active.map(s => s.id));
    const taken = {}, place = {};
    const avail = [];

    for(const p of people){
      const rk = p.k + "|" + p.s;
      const st8 = presentAt(p, t, st);
      if(st8 === "off"){ grid[rk][c] = { c:"", t:"off" }; continue; }
      if(st8 === "lv"){ grid[rk][c] = { c:"LV", t:"lv" }; continue; }
      if(st8 === "trn"){ grid[rk][c] = { c:"TRN", t:"trn" }; continue; }
      if(p.breaks.indexOf(c) >= 0){ grid[rk][c] = { c:"B", t:"brk" }; if(R.breakClears) prevSeat[rk] = null; continue; }
      avail.push(p);
    }

    /* Coverage budget, computed per modset. Officers never cross modsets
       automatically, so each modset fills only as many of its own seats as it
       has bodies for — the rest shed in the configured drop order (SO first).
       Keeping the budget per modset also keeps each ring the same size as its
       crew, which is what makes the rotation advance cleanly. */
    const rankedActive = seatsRanked.filter(s => activeIds.has(s.id));
    const availByMod = {};
    for(const p of avail) if(p.mod != null) (availByMod[p.mod] = availByMod[p.mod] || []).push(p);
    const allowed = new Set();
    for(const m of mods){
      const own = rankedActive.filter(s => s.mod === m);
      const n = (availByMod[m] || []).length;
      own.slice(0, n).forEach(s => allowed.add(s.id));
    }
    for(const p of avail) if(p.pinned && p.pinSeat && activeIds.has(p.pinSeat)) allowed.add(p.pinSeat);

    /* pass A — pinned officers hold their seat */
    for(const p of avail){
      if(!p.pinned || !p.pinSeat || !activeIds.has(p.pinSeat) || taken[p.pinSeat]) continue;
      taken[p.pinSeat] = p; place[p.k + "|" + p.s] = p.pinSeat;
    }
    /* pass B — ring advance.
       The effective ring is this modset's ring reduced to the seats inside the
       coverage budget. Officers hold a stable order within the modset, so
       stepping the whole line one place per column gives every officer a
       distinct seat and a clean walk around the ring. */
    for(const m of mods){
      const eff = (rings[m] || []).filter(id => activeIds.has(id) && allowed.has(id) && !taken[id]);
      if(!eff.length) continue;
      const grp = (availByMod[m] || []).filter(p => !place[p.k + "|" + p.s]).sort((a,b) => a.slot - b.slot);
      for(let i = 0; i < grp.length; i++){
        const p = grp[i], rk = p.k + "|" + p.s;
        for(let k = 0; k < eff.length; k++){
          const id = eff[(c + i + k) % eff.length];
          if(taken[id]) continue;
          const s = byId[id];
          if(!seatAllows(cfg, p, s)) continue;
          if(!R.allowRepeat && prevSeat[rk] === codeOf(id) && eff.length > 1) continue;
          taken[id] = p; place[rk] = id; break;
        }
      }
    }
    /* pass C — fill remaining seats by priority from anyone left */
    const left = avail.filter(p => !place[p.k + "|" + p.s]);
    for(const s of rankedActive){
      if(taken[s.id] || !allowed.has(s.id)) continue;
      const p = left.find(x => x.mod === s.mod && !place[x.k + "|" + x.s] && seatAllows(cfg, x, s) &&
                               (R.allowRepeat || prevSeat[x.k + "|" + x.s] !== s.code));
      if(p){ taken[s.id] = p; place[p.k + "|" + p.s] = s.id; }
    }
    /* pass C2 — an officer still standing may open a lower-priority seat in
       their own modset rather than sit out; crossing modsets stays manual. */
    for(const s of rankedActive){
      if(taken[s.id]) continue;
      const p = left.find(x => x.mod === s.mod && !place[x.k + "|" + x.s] && seatAllows(cfg, x, s) &&
                               (R.allowRepeat || prevSeat[x.k + "|" + x.s] !== s.code));
      if(p){ taken[s.id] = p; place[p.k + "|" + p.s] = s.id; }
    }

    /* pass D — Body Scanner gender pairing repair */
    for(const m of mods){
      const A = taken["SO" + m + "-A"], B = taken["SO" + m + "-B"];
      if(!A || !B || A.sex !== B.sex) continue;
      const wantF = A.sex !== "F";
      const cand = avail.find(p =>
        p.mod === m && p.sex === (wantF ? "F" : "M") && !p.pinned &&
        place[p.k + "|" + p.s] && place[p.k + "|" + p.s] !== "SO" + m + "-A" && place[p.k + "|" + p.s] !== "SO" + m + "-B" &&
        seatAllows(cfg, p, byId["SO" + m + "-B"]) && seatAllows(cfg, B, byId[place[p.k + "|" + p.s]]) &&
        (R.allowRepeat || (prevSeat[p.k + "|" + p.s] !== "SO" + m &&
                           prevSeat[B.k + "|" + B.s] !== codeOf(place[p.k + "|" + p.s]))));
      if(cand){
        const ck = cand.k + "|" + cand.s, bk = B.k + "|" + B.s;
        const oldSeat = place[ck];
        place[ck] = "SO" + m + "-B"; taken["SO" + m + "-B"] = cand;
        place[bk] = oldSeat; taken[oldSeat] = B;
      } else {
        diag.push({ k:"w", m:`${m2t(t)} · modset ${m}: Body Scanner pairing not met (two ${A.sex === "F" ? "female" : "male"} officers) — no eligible swap available.` });
      }
    }

    /* pass E — final guard against back-to-back repeats.
       Breaks and arrivals shift the line, which can occasionally cancel out the
       column advance and land an officer on the seat they just left. Swap with
       a colleague in the same modset where possible; report it where not. */
    if(!R.allowRepeat){
      for(const p of avail){
        const rk = p.k + "|" + p.s;
        const id = place[rk];
        if(!id || p.pinned || prevSeat[rk] !== codeOf(id)) continue;
        let done = false;
        for(const q of avail){
          if(q === p || q.mod !== p.mod || q.pinned) continue;
          const qk = q.k + "|" + q.s, qid = place[qk];
          if(!qid || qid === id) continue;
          if(prevSeat[qk] === codeOf(id) || prevSeat[rk] === codeOf(qid)) continue;
          if(!seatAllows(cfg, p, byId[qid]) || !seatAllows(cfg, q, byId[id])) continue;
          place[rk] = qid; taken[qid] = p;
          place[qk] = id;  taken[id]  = q;
          done = true; break;
        }
        if(!done){
          forced[rk + ":" + c] = 1;
          diag.push({ k:"i", m:`${m2t(t)}: <b>${esc(p.n)}</b> holds ${byId[id].code} for a second block — no legal swap in modset ${p.mod} at that moment.` });
        }
      }
    }

    /* commit */
    for(const p of avail){
      const rk = p.k + "|" + p.s;
      const id = place[rk];
      if(id){
        const s = byId[id];
        grid[rk][c] = { c:s.code, t:s.fam === "SO" ? "so" : "on", id, fam:s.fam,
                        pin:p.pinned ? 1 : 0, forced: forced[rk + ":" + c] ? 1 : 0 };
        prevSeat[rk] = s.code;
      } else {
        grid[rk][c] = { c:"—", t:"sur" };
        prevSeat[rk] = null;
        (surplusCols[c] = surplusCols[c] || []).push(p.n);
      }
    }
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

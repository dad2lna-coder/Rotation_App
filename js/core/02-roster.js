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

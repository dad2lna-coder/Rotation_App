
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

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

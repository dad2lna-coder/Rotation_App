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

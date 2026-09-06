/** Headcount allocation & line building — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.operatingSlots = function (openMin, closeMin) {
    var slots = [];
    for (var t = openMin; t < closeMin; t += 30) slots.push(t);
    return slots;
  };

  S.refineBalance = function (counts, slots, totalPeople, lockedIds) {
    var locked = lockedIds || {};
    var c = Object.assign({}, counts);
    var ids = Object.keys(c);
    if (ids.length < 2) return c;

    function coverageRange(cc) {
      var lo = Infinity, hi = -Infinity;
      slots.forEach(function (slot) {
        var n = 0;
        ids.forEach(function (id) {
          if (S.shiftCoversSlot(id, slot)) n += cc[id] || 0;
        });
        if (n < lo) lo = n;
        if (n > hi) hi = n;
      });
      return hi - lo;
    }

    var best = coverageRange(c);
    for (var iter = 0; iter < 80; iter++) {
      var improved = false;
      for (var i = 0; i < ids.length; i++) {
        if (locked[ids[i]]) continue;
        for (var j = 0; j < ids.length; j++) {
          if (i === j || (c[ids[i]] || 0) <= 0) continue;
          if (locked[ids[j]]) continue;
          c[ids[i]]--;
          c[ids[j]] = (c[ids[j]] || 0) + 1;
          var r = coverageRange(c);
          if (r < best) { best = r; improved = true; }
          else { c[ids[j]]--; c[ids[i]]++; }
        }
      }
      if (!improved) break;
    }
    return c;
  };

  S.allocateShiftHeadcounts = function (totalPeople, openMin, closeMin) {
    var slots = S.operatingSlots(openMin, closeMin);
    var eligible = S.state.shifts.filter(function (s) {
      return S.shiftOverlapsWindow(s, openMin, closeMin);
    });
    if (!eligible.length || totalPeople <= 0) return { counts: {}, mode: "none" };

    var forced = {}, forcedSum = 0;
    eligible.forEach(function (s) {
      var p = Math.max(0, Math.floor(Number(s.force) || 0));
      if (p > 0) { forced[s.id] = p; forcedSum += p; }
    });

    if (forcedSum > totalPeople) {
      S.state.issues.push("Force total (" + forcedSum + ") exceeds staff (" + totalPeople + ") — scaled down proportionally.");
      var scale = totalPeople / forcedSum, used = 0;
      var ids = Object.keys(forced);
      ids.forEach(function (id, i) {
        if (i === ids.length - 1) forced[id] = totalPeople - used;
        else { forced[id] = Math.floor(forced[id] * scale); used += forced[id]; }
      });
      forcedSum = totalPeople;
    }

    var freePool = totalPeople - forcedSum;
    var freeShifts = eligible.filter(function (s) { return !forced[s.id]; });
    if (freePool > 0 && !freeShifts.length) {
      S.state.issues.push("All shifts have Force > 0 but " + freePool + " people left unassigned — add a shift with Force 0 or raise a force.");
    }

    var counts = Object.assign({}, forced);
    freeShifts.forEach(function (s) { counts[s.id] = counts[s.id] || 0; });

    if (freeShifts.length && freePool > 0) {
      var weights = freeShifts.map(function (s) {
        var w = 0;
        slots.forEach(function (slot) { if (S.shiftCoversSlot(s.id, slot)) w++; });
        return Math.max(1, w);
      });
      var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
      var assigned = 0;
      freeShifts.forEach(function (s, i) {
        if (i === freeShifts.length - 1) counts[s.id] = (counts[s.id] || 0) + (freePool - assigned);
        else {
          var n = Math.floor((freePool * weights[i]) / wsum);
          counts[s.id] = (counts[s.id] || 0) + n;
          assigned += n;
        }
      });
    }
    return { counts: S.refineBalance(counts, slots, totalPeople, forced), mode: "heuristic" };
  };

  function takeFromPools(pools, preferLongFt, placed) {
    placed = placed || { M: 0, F: 0 };
    function take(emp, sex) {
      var key = emp + sex;
      if (pools[key] > 0) { pools[key]--; return { empClass: emp, sex: sex }; }
      return null;
    }
    var startM = (S.state.ftM || 0) + (S.state.ptM || 0);
    var startF = (S.state.ftF || 0) + (S.state.ptF || 0);
    var startT = startM + startF;
    var targetFShare = startT > 0 ? startF / startT : 0.5;
    function pickSex(emp) {
      var mLeft = pools[emp + "M"] || 0, fLeft = pools[emp + "F"] || 0;
      if (mLeft <= 0 && fLeft <= 0) return null;
      if (mLeft <= 0) return take(emp, "F");
      if (fLeft <= 0) return take(emp, "M");
      var placedT = placed.M + placed.F;
      if (placedT === 0) return targetFShare >= 0.5 ? take(emp, "F") : take(emp, "M");
      var currentFShare = placed.F / placedT;
      if (currentFShare < targetFShare - 0.02) return take(emp, "F");
      if (currentFShare > targetFShare + 0.02) return take(emp, "M");
      return mLeft >= fLeft ? take(emp, "M") : take(emp, "F");
    }
    if (preferLongFt) return pickSex("FT");
    var ftLeft = (pools.FTM || 0) + (pools.FTF || 0);
    var ptLeft = (pools.PTM || 0) + (pools.PTF || 0);
    if (ftLeft > 0) return pickSex("FT");
    if (ptLeft > 0) return pickSex("PT");
    return null;
  }

  function makeLineFromPerson(def, person, id) {
    var workDays = S.targetWorkDays(def.id, person.empClass);
    var rdoCount = 7 - workDays;
    var seed = (id - 1) % 7;
    var hard = Array.isArray(def.rdoHard)
      ? def.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
      : [];
    var rdoDays;
    if (hard.length > 0) {
      rdoDays = hard.slice();
      if (rdoDays.length < rdoCount) {
        for (var d = 0; d < 7 && rdoDays.length < rdoCount; d++) {
          if (rdoDays.indexOf(d) < 0) rdoDays.push(d);
        }
      } else if (rdoDays.length > rdoCount) rdoDays = rdoDays.slice(0, rdoCount);
    } else rdoDays = S.consecutiveRdos(rdoCount, seed);
    return {
      id: id,
      lineCode: "Line " + String(id).padStart(3, "0"),
      shiftId: def.id,
      shiftName: def.name,
      shiftLabel: S.shiftLabel(def),
      empClass: person.empClass,
      sex: person.sex,
      function: "", // DFO | PAX | BAG | "" — assigned secondarily
      rdoDays: rdoDays,
      rdoHard: hard.length > 0,
      paid: def.paid || 8
    };
  }

  S.buildLines = function (counts) {
    var lines = [], id = 1;
    var pools = { FTM: S.state.ftM || 0, FTF: S.state.ftF || 0, PTM: S.state.ptM || 0, PTF: S.state.ptF || 0 };
    var placedGlobal = { M: 0, F: 0 };
    function fillShift(def, need) {
      var placed = 0;
      while (placed < need) {
        var isLong = (+def.paid || 8) >= 10;
        var person = takeFromPools(pools, isLong, placedGlobal);
        if (!person) break;
        placedGlobal[person.sex]++;
        lines.push(makeLineFromPerson(def, person, id));
        id++; placed++;
      }
      if (placed < need) {
        S.state.issues.push(def.name + ": needed " + need + " people, only placed " + placed + " (pool empty or 4×10 needs FT).");
      }
    }
    S.state.shifts.forEach(function (def) {
      var need = counts[def.id] || 0;
      if (need > 0 && (def.force || 0) > 0) fillShift(def, need);
    });
    S.state.shifts.forEach(function (def) {
      var need = counts[def.id] || 0;
      if (need > 0 && !(def.force > 0)) fillShift(def, need);
    });
    return lines;
  };

  S.allocateSupervisoryHeadcounts = function (totalSup, openMin, closeMin, forceField, tsoLines) {
    var slots = S.operatingSlots(openMin, closeMin);
    var eligible = S.state.shifts.filter(function (s) {
      return S.shiftOverlapsWindow(s, openMin, closeMin);
    });
    if (!eligible.length || totalSup <= 0) return { counts: {} };

    var forced = {}, forcedSum = 0;
    eligible.forEach(function (s) {
      var p = Math.max(0, Math.floor(Number(s[forceField]) || 0));
      if (p > 0) { forced[s.id] = p; forcedSum += p; }
    });
    if (forcedSum > totalSup) {
      S.state.issues.push(forceField.replace("Force", "").toUpperCase() + " force total (" + forcedSum + ") exceeds pool (" + totalSup + ") — scaled down.");
      var scale = totalSup / forcedSum, used = 0;
      var ids = Object.keys(forced);
      ids.forEach(function (id, i) {
        if (i === ids.length - 1) forced[id] = totalSup - used;
        else { forced[id] = Math.floor(forced[id] * scale); used += forced[id]; }
      });
      forcedSum = totalSup;
    }
    var freePool = totalSup - forcedSum;
    var freeShifts = eligible.filter(function (s) { return !forced[s.id]; });
    var counts = Object.assign({}, forced);
    freeShifts.forEach(function (s) { counts[s.id] = counts[s.id] || 0; });
    if (freeShifts.length && freePool > 0) {
      var tsoOn = {};
      (tsoLines || S.state.lines).forEach(function (l) {
        if (l.isStso || l.isLtso) return;
        tsoOn[l.shiftId] = (tsoOn[l.shiftId] || 0) + 1;
      });
      var weights = freeShifts.map(function (s) {
        if (tsoOn[s.id] > 0) return tsoOn[s.id];
        var w = 0;
        slots.forEach(function (slot) { if (S.shiftCoversSlot(s.id, slot)) w++; });
        return Math.max(1, w);
      });
      var wsum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
      var assigned = 0;
      freeShifts.forEach(function (s, i) {
        if (i === freeShifts.length - 1) counts[s.id] = (counts[s.id] || 0) + (freePool - assigned);
        else {
          var n = Math.floor((freePool * weights[i]) / wsum);
          counts[s.id] = (counts[s.id] || 0) + n;
          assigned += n;
        }
      });
    }
    return { counts: S.refineBalance(counts, slots, totalSup, forced) };
  };

  function takeSupervisoryFromPools(pools, targetFShare, placed) {
    placed = placed || { M: 0, F: 0 };
    function take(sex) {
      if (pools[sex] > 0) { pools[sex]--; return sex; }
      return null;
    }
    if (pools.M <= 0 && pools.F <= 0) return null;
    if (pools.M <= 0) return take("F");
    if (pools.F <= 0) return take("M");
    var placedT = placed.M + placed.F;
    if (placedT === 0) return targetFShare >= 0.5 ? take("F") : take("M");
    var currentFShare = placed.F / placedT;
    if (currentFShare < targetFShare - 0.02) return take("F");
    if (currentFShare > targetFShare + 0.02) return take("M");
    return pools.M >= pools.F ? take("M") : take("F");
  }

  S.buildSupervisoryLines = function (supCounts, supType) {
    var lines = [];
    var isLtso = supType === "LTSO";
    var id = isLtso ? 20000 : 10000;
    var pools = {
      M: isLtso ? (S.state.ltsoM || 0) : (S.state.stsoM || 0),
      F: isLtso ? (S.state.ltsoF || 0) : (S.state.stsoF || 0)
    };
    var totalM = isLtso ? (S.state.ltsoM || 0) : (S.state.stsoM || 0);
    var totalF = isLtso ? (S.state.ltsoF || 0) : (S.state.stsoF || 0);
    var totalSup = totalM + totalF;
    var targetFShare = totalSup > 0 ? totalF / totalSup : 0.5;
    var placedGlobal = { M: 0, F: 0 };
    var forceField = isLtso ? "ltsoForce" : "stsoForce";

    function fill(def, need) {
      var placed = 0;
      while (placed < need) {
        var sex = takeSupervisoryFromPools(pools, targetFShare, placedGlobal);
        if (!sex) break;
        placedGlobal[sex]++;
        var workDays = (+def.paid || 8) >= 10 ? 4 : 5;
        var rdoCount = 7 - workDays;
        var hard = Array.isArray(def.rdoHard)
          ? def.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
          : [];
        var rdoDays;
        if (hard.length > 0) {
          rdoDays = hard.slice();
          if (rdoDays.length < rdoCount) {
            for (var d = 0; d < 7 && rdoDays.length < rdoCount; d++) {
              if (rdoDays.indexOf(d) < 0) rdoDays.push(d);
            }
          } else if (rdoDays.length > rdoCount) rdoDays = rdoDays.slice(0, rdoCount);
        } else rdoDays = S.consecutiveRdos(rdoCount, (id - 1) % 7);
        lines.push({
          id: id,
          lineCode: supType + " " + String(lines.length + 1).padStart(2, "0"),
          shiftId: def.id,
          shiftName: def.name,
          shiftLabel: S.shiftLabel(def),
          empClass: supType,
          position: supType,
          isLtso: isLtso,
          isStso: !isLtso,
          sex: sex,
          function: "",
          rdoDays: rdoDays,
          rdoHard: hard.length > 0,
          paid: def.paid || 8
        });
        id++; placed++;
      }
      if (placed < need) S.state.issues.push(def.name + ": " + supType + " needed " + need + ", placed " + placed + ".");
    }

    S.state.shifts.forEach(function (def) {
      var need = supCounts[def.id] || 0;
      if (need > 0 && (def[forceField] || 0) > 0) fill(def, need);
    });
    S.state.shifts.forEach(function (def) {
      var need = supCounts[def.id] || 0;
      if (need > 0 && !(def[forceField] > 0)) fill(def, need);
    });
    return lines;
  };

  S.readCertConfigFromDom = function () {
    var dfoEl = S.$("cfg-cert-dfo");
    var paxEl = S.$("cfg-cert-pax");
    var bagEl = S.$("cfg-cert-bag");
    var dfoOn = S.$("cfg-cert-dfo-on");
    var bagOn = S.$("cfg-cert-bag-on");
    S.state.certDfoMax = Math.max(0, Math.floor(+(dfoEl && dfoEl.value) || 0));
    S.state.certPaxMax = Math.max(0, Math.floor(+(paxEl && paxEl.value) || 0));
    S.state.certBagMax = Math.max(0, Math.floor(+(bagEl && bagEl.value) || 0));
    S.state.certDfoEnabled = !dfoOn || !!dfoOn.checked;
    S.state.certBagEnabled = !bagOn || !!bagOn.checked;
  };

  /** Clear function tags on all lines */
  S.clearLineFunctions = function () {
    (S.state.lines || []).forEach(function (l) {
      l.function = "";
    });
  };

  /**
   * Secondary pass: assign DFO / PAX / BAG to existing lines without changing schedules.
   * Supervisors (STSO/LTSO) are skipped. Spreads across shifts and balances sex when possible.
   */
  S.assignCertifications = function () {
    S.readCertConfigFromDom();
    if (!S.state.lines || !S.state.lines.length) {
      if (S.updateStatus) S.updateStatus("Generate lines first, then assign certifications.");
      return;
    }

    // Reset functions then assign
    S.clearLineFunctions();

    var need = [];
    if (S.state.certDfoEnabled && S.state.certDfoMax > 0) {
      for (var i = 0; i < S.state.certDfoMax; i++) need.push("DFO");
    }
    if (S.state.certPaxMax > 0) {
      for (var j = 0; j < S.state.certPaxMax; j++) need.push("PAX");
    }
    if (S.state.certBagEnabled && S.state.certBagMax > 0) {
      for (var k = 0; k < S.state.certBagMax; k++) need.push("BAG");
    }

    if (!need.length) {
      if (S.renderLines) S.renderLines();
      if (S.updateStatus) S.updateStatus("No certification targets (max 0 or disabled). Functions cleared.");
      return;
    }

    // Eligible: operational TSO only (FT/PT), not STSO/LTSO
    var eligible = S.state.lines.filter(function (l) {
      return !l.isStso && !l.isLtso && l.empClass !== "STSO" && l.empClass !== "LTSO";
    });

    // Sort for spread: by shift start, then alternate sex preference
    eligible.sort(function (a, b) {
      var sa = S.getShift ? S.getShift(a.shiftId) : null;
      var sb = S.getShift ? S.getShift(b.shiftId) : null;
      var ma = sa ? S.timeToMin(sa.start) : 0;
      var mb = sb ? S.timeToMin(sb.start) : 0;
      if (ma !== mb) return ma - mb;
      if (a.sex !== b.sex) return a.sex === "F" ? -1 : 1;
      return (a.id || 0) - (b.id || 0);
    });

    var assigned = { DFO: 0, PAX: 0, BAG: 0 };
    var used = {};
    var ei = 0;
    need.forEach(function (fn) {
      // Find next unused eligible line
      var tries = 0;
      while (tries < eligible.length) {
        var line = eligible[ei % eligible.length];
        ei++;
        tries++;
        if (!line || used[line.id]) continue;
        // Prefer lines that don't already have a function
        if (line.function) continue;
        line.function = fn;
        used[line.id] = true;
        assigned[fn]++;
        return;
      }
    });

    if (S.renderLines) S.renderLines();
    if (S.renderTeams) S.renderTeams();
    var hint = S.$("cert-assign-hint");
    var msg =
      "Assigned DFO " + assigned.DFO +
      " · PAX " + assigned.PAX +
      " · BAG " + assigned.BAG +
      " (schedules unchanged)";
    if (hint) hint.textContent = msg;
    if (S.updateStatus) S.updateStatus(msg);
  };
})(window.Scheduler);

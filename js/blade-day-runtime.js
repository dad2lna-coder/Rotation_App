/**
 * Runtime day-cell resolver.
 * BLADE stores schedule[id][dow] as WORK|RDO and the visible cell as 0330-1200
 * (shiftLabel / getEffectiveShiftTimes). Named Sunday…Saturday fields are often empty.
 * This module materializes the real cell and patches Adapter + Interchange classification.
 */
(function (global) {
  "use strict";

  var DEBUG = [];
  var DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function Sch() { return global.Scheduler; }
  function Ad() { return global.BladeLinesAdapter; }

  function compactRange(start, end) {
    function hhmm(t) {
      if (t == null) return "";
      var s = String(t).trim();
      var m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m) return (m[1].length < 2 ? "0" + m[1] : m[1]) + m[2];
      var d = s.replace(/\D/g, "");
      if (d.length === 3) return "0" + d;
      return d;
    }
    var a = hhmm(start), b = hhmm(end);
    if (!a || !b) return "";
    return a + "-" + b;
  }

  function schedVal(line, di) {
    var S = Sch();
    if (!S || !S.state || !S.state.schedule || !line) return "";
    var row = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
    return row[di] == null ? "" : row[di];
  }

  function timesFromShift(line, di) {
    var S = Sch();
    if (!S || !line) return null;
    if (S.getEffectiveShiftTimes && line.shiftId) {
      var eff = S.getEffectiveShiftTimes(line.shiftId, di);
      if (eff && eff.start && eff.end) return { start: eff.start, end: eff.end, via: "effectiveShiftTimes" };
    }
    if (S.getShift && line.shiftId) {
      var sh = S.getShift(line.shiftId);
      if (sh && sh.start && sh.end) return { start: sh.start, end: sh.end, via: "shift" };
    }
    if (line.shiftLabel) return { label: line.shiftLabel, via: "shiftLabel" };
    return null;
  }

  function resolveRaw(line, di) {
    var ad = Ad();
    var named = ad && ad.dayValueOf ? ad.dayValueOf(line, di) : "";
    if (named != null && String(named).trim() !== "") return { raw: String(named), from: "named-field" };

    var sv = schedVal(line, di);
    if (sv != null && String(sv).trim() !== "") {
      var s = String(sv).trim();
      if (ad && ad.parseTime && ad.parseTime(s)) return { raw: s, from: "schedule-range" };
      if (/^(RDO|OFF)$/i.test(s)) return { raw: s.toUpperCase() === "OFF" ? "OFF" : "RDO", from: "schedule-off" };
      if (/^(WORK|WORKING)$/i.test(s)) {
        var t = timesFromShift(line, di);
        if (t && t.label && ad && ad.parseTime && ad.parseTime(t.label)) {
          return { raw: t.label, from: "schedule-work+shiftLabel" };
        }
        if (t && t.start && t.end) {
          return { raw: compactRange(t.start, t.end), from: "schedule-work+" + t.via };
        }
        return { raw: "WORK", from: "schedule-work" };
      }
      return { raw: s, from: "schedule-other" };
    }

    var t2 = timesFromShift(line, di);
    if (t2 && t2.start && t2.end) {
      return { raw: compactRange(t2.start, t2.end), from: "shift-only" };
    }
    if (line && line.shiftLabel) return { raw: String(line.shiftLabel), from: "shiftLabel-only" };
    return { raw: "", from: "blank" };
  }

  function classify(line, day) {
    var ad = Ad();
    var di = ad && ad.dayIndex ? ad.dayIndex(day) : day;
    if (di < 0 || di > 6) di = +day;
    var hit = resolveRaw(line, di);
    var raw = hit.raw;
    var parsed = ad && ad.parseTime ? ad.parseTime(raw) : null;
    var rec = {
      raw: raw,
      rawFrom: hit.from,
      status: "UNKNOWN",
      start: "",
      end: "",
      startMin: null,
      endMin: null,
      shift: "",
      source: hit.from
    };
    if (/^(RDO|OFF|DAY\s*OFF)$/i.test(String(raw).trim())) {
      rec.status = "OFF";
      rec.source = "off-token";
    } else if (parsed) {
      rec.status = "WORKING";
      rec.start = parsed.start;
      rec.end = parsed.end;
      rec.startMin = parsed.startMin;
      rec.endMin = parsed.endMin;
      rec.shift = parsed.shift;
      rec.source = "time-range:" + hit.from;
    } else if (/^(WORK|WORKING)$/i.test(String(raw).trim())) {
      rec.status = "WORKING";
      var fb = ad && ad.rowStartEnd ? ad.rowStartEnd(line) : null;
      if (fb) {
        rec.start = fb.start; rec.end = fb.end;
        rec.startMin = fb.startMin; rec.endMin = fb.endMin;
        rec.shift = fb.shift; rec.source = "work-token+row-start-end";
      } else rec.source = "work-token-missing-time";
    } else {
      rec.status = String(raw).trim() ? "UNKNOWN" : "UNKNOWN";
      rec.source = String(raw).trim() ? "unrecognized" : "blank";
    }
    return rec;
  }

  function materializeLine(line) {
    if (!line) return line;
    for (var di = 0; di < 7; di++) {
      var hit = resolveRaw(line, di);
      line[DAY_FULL[di]] = hit.raw;
      line[DAY_SHORT[di]] = hit.raw;
    }
    return line;
  }

  function materializeAll() {
    var S = Sch();
    var lines = (S && S.state && S.state.lines) || [];
    lines.forEach(materializeLine);
    return lines.length;
  }

  function debugSample(limit) {
    DEBUG = [];
    var S = Sch();
    var lines = (S && S.state && S.state.lines) || [];
    var cap = limit || 24;
    for (var i = 0; i < lines.length && DEBUG.length < cap; i++) {
      for (var d = 0; d < 7 && DEBUG.length < cap; d++) {
        var c = classify(lines[i], d);
        DEBUG.push({
          line: lines[i].lineCode || lines[i].id,
          day: DAY_SHORT[d],
          rawDayValue: c.raw,
          dayStatus: c.status,
          start: c.start,
          end: c.end,
          source: c.source
        });
      }
    }
    try { console.table(DEBUG); } catch (e) { console.log(DEBUG); }
    var work = 0, off = 0, unk = 0;
    lines.forEach(function (line) {
      for (var d = 0; d < 7; d++) {
        var c = classify(line, d);
        if (c.status === "WORKING") work++;
        else if (c.status === "OFF") off++;
        else unk++;
      }
    });
    var msg = "Day debug: WORKING " + work + " · OFF " + off + " · UNKNOWN " + unk +
      " · sample rawDayValue → dayStatus → start → end in console";
    if (S && S.updateStatus) S.updateStatus(msg);
    var host = document.getElementById("rosterInfo");
    if (host) {
      host.innerHTML = "<b>" + work + "</b> working · <b>" + off + "</b> OFF · <b>" + unk +
        "</b> unknown<br><pre style=\"max-height:12rem;overflow:auto;font-size:11px\">" +
        DEBUG.map(function (r) {
          return r.line + " " + r.day + "  " + JSON.stringify(r.rawDayValue) +
            " → " + r.dayStatus + " → " + (r.start || "") + " → " + (r.end || "");
        }).join("\n") + "</pre>";
    }
    return { work: work, off: off, unknown: unk, sample: DEBUG };
  }

  function patchAdapter() {
    var ad = Ad();
    if (!ad || ad._runtimePatched) return;
    var origDay = ad.dayValueOf;
    var origCls = ad.classifyDay;
    ad.dayValueOf = function (line, di) {
      var named = origDay ? origDay(line, di) : "";
      if (named != null && String(named).trim() !== "") return named;
      return resolveRaw(line, di).raw;
    };
    ad.classifyDay = function (line, day) {
      return classify(line, day);
    };
    ad.resolveRaw = resolveRaw;
    ad.materializeAll = materializeAll;
    ad.debugSample = debugSample;
    ad._runtimePatched = true;
  }

  function patchInterchange() {
    var B = global.BladeInterchange;
    if (!B || B._runtimePatched) return;
    var origBuild = B.buildModel;
    B.buildModel = function () {
      materializeAll();
      var stats = debugSample(28);
      var model = origBuild ? origBuild() : { summary: [], days: [[],[],[],[],[],[],[]], raw: [], placement: [], functions: [], validation: [] };
      if (model && model.summary) {
        model.summary.push({ Field: "runtime WORKING", Value: stats.work });
        model.summary.push({ Field: "runtime OFF", Value: stats.off });
        model.summary.push({ Field: "runtime UNKNOWN", Value: stats.unknown });
        model.summary.push({ Field: "debug", Value: "rawDayValue → dayStatus → start → end" });
        stats.sample.forEach(function (r, i) {
          model.summary.push({
            Field: "dbg" + i,
            Value: r.line + " " + r.day + " | " + r.rawDayValue + " → " + r.dayStatus + " → " + r.start + " → " + r.end
          });
        });
      }
      return model;
    };
    B._runtimePatched = true;
  }

  function wrapPush() {
    var prev = global.pushLinesToRotation;
    global.pushLinesToRotation = function () {
      materializeAll();
      debugSample(16);
      if (typeof prev === "function") return prev.apply(this, arguments);
    };
  }

  function boot() {
    patchAdapter();
    patchInterchange();
    wrapPush();
    materializeAll();
  }

  global.BladeDayRuntime = {
    resolveRaw: resolveRaw,
    classify: classify,
    materializeAll: materializeAll,
    debugSample: debugSample,
    boot: boot
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 50); });
  else setTimeout(boot, 50);
})(typeof window !== "undefined" ? window : this);

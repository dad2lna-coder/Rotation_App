/**
 * BLADE Lines → Rotation compact-row adapter
 *
 * Sun–Sat day cell is authoritative when it contains a time range.
 *   0330-1200 → WORKING 03:30–12:00
 *   0400-1230 → WORKING 04:00–12:30
 *   RDO / OFF → OFF
 * WORKING with no valid time → row Start/End fallback.
 * Blank / unrecognized is NOT OFF.
 * Raw day value is always preserved. Nothing invents TDC/BAG/DFO/Location/Modset/IDs/quals.
 */
(function (global) {
  "use strict";

  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_ALIASES = {
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5, sat: 6, saturday: 6
  };

  /* Explicit off tokens only. Blank is not OFF. */
  var OFF_RE = /^(OFF|RDO|DAY\s*OFF|LEAVE|VAC|VACATION)$/i;
  var WORK_RE = /^(WORK|WORKING|ON|DUTY|YES|Y)$/i;

  function dayIndex(day) {
    if (day == null || day === "") return -1;
    if (typeof day === "number" && isFinite(day)) {
      var n = Math.floor(day);
      return n >= 0 && n <= 6 ? n : -1;
    }
    var s = String(day).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(DAY_ALIASES, s)) return DAY_ALIASES[s];
    var asNum = parseInt(s, 10);
    if (String(asNum) === s && asNum >= 0 && asNum <= 6) return asNum;
    return -1;
  }

  function dayName(day) {
    var i = dayIndex(day);
    return i >= 0 ? DAY_SHORT[i] : "";
  }

  function fmt(m) {
    var n = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(n / 60);
    var mi = n % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
  }

  function parseOneTime(token) {
    if (token == null) return null;
    var t = String(token).trim();
    if (!t) return null;
    var ampm = null;
    var mAmpm = t.match(/\b(am|pm)\b/i);
    if (mAmpm) {
      ampm = mAmpm[1].toLowerCase();
      t = t.replace(/\b(am|pm)\b/i, "").trim();
    }
    var colon = t.match(/^(\d{1,2}):(\d{2})$/);
    if (colon) {
      var h = parseInt(colon[1], 10);
      var mi = parseInt(colon[2], 10);
      if (h > 23 || mi > 59) return null;
      if (ampm === "pm" && h < 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      return h * 60 + mi;
    }
    var digits = t.replace(/\D/g, "");
    if (digits.length === 3 || digits.length === 4) {
      var hh = digits.length === 3 ? parseInt(digits.slice(0, 1), 10) : parseInt(digits.slice(0, 2), 10);
      var mm = digits.length === 3 ? parseInt(digits.slice(1), 10) : parseInt(digits.slice(2), 10);
      if (mm > 59) return null;
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      if (!ampm && hh > 23) return null;
      return hh * 60 + mm;
    }
    return null;
  }

  function parseTime(value) {
    if (value == null) return null;
    var raw = String(value).trim();
    if (!raw || OFF_RE.test(raw) || WORK_RE.test(raw)) return null;
    var parts = raw.split(/\s*[-\u2013\u2014]\s*/);
    if (parts.length < 2) return null;
    var startMin = parseOneTime(parts[0].replace(/^[^\d]*/, "").trim());
    var endMin = parseOneTime(parts[1].replace(/^[^\d]*/, "").trim());
    if (startMin == null || endMin == null) {
      var cleaned = raw.replace(/[^\d:apmAPM\s\-\u2013\u2014]/g, " ").trim();
      parts = cleaned.split(/\s*[-\u2013\u2014]\s*/);
      if (parts.length >= 2) {
        startMin = parseOneTime(parts[0].trim());
        endMin = parseOneTime(parts[1].trim());
      }
    }
    if (startMin == null || endMin == null) return null;
    var endInternal = endMin <= startMin ? endMin + 1440 : endMin;
    return {
      startMin: startMin,
      endMin: endInternal,
      start: fmt(startMin),
      end: fmt(endMin),
      shift: startMin < 12 * 60 ? "AM" : "PM",
      raw: raw,
      source: "day-cell"
    };
  }

  function rowStartEnd(line) {
    if (!line) return null;
    var startRaw = line.Start != null && line.Start !== "" ? line.Start : (line.start != null && line.start !== "" ? line.start : line.startTime);
    var endRaw = line.End != null && line.End !== "" ? line.End : (line.end != null && line.end !== "" ? line.end : line.endTime);
    var startMin = null;
    var endMin = null;
    if (typeof startRaw === "number" && isFinite(startRaw)) startMin = startRaw;
    else startMin = parseOneTime(startRaw);
    if (typeof endRaw === "number" && isFinite(endRaw)) endMin = endRaw;
    else endMin = parseOneTime(endRaw);
    if (startMin == null || endMin == null) {
      var combo = startRaw && endRaw ? String(startRaw) + "-" + String(endRaw) : "";
      var parsed = combo ? parseTime(combo) : null;
      if (parsed) return parsed;
      return null;
    }
    var endInternal = endMin <= startMin ? endMin + 1440 : endMin;
    return {
      startMin: startMin,
      endMin: endInternal,
      start: fmt(startMin),
      end: fmt(endMin),
      shift: startMin < 12 * 60 ? "AM" : "PM",
      raw: String(startRaw) + "-" + String(endRaw),
      source: "row-start-end"
    };
  }

  function dayValueOf(line, di) {
    if (!line || di < 0 || di > 6) return "";
    var short = DAY_SHORT[di];
    var full = DAY_FULL[di];
    if (line[full] != null && line[full] !== "") return line[full];
    if (line[short] != null && line[short] !== "") return line[short];
    if (line[full.toLowerCase()] != null && line[full.toLowerCase()] !== "") return line[full.toLowerCase()];
    if (line[short.toLowerCase()] != null && line[short.toLowerCase()] !== "") return line[short.toLowerCase()];
    if (line.days && typeof line.days === "object") {
      if (line.days[short] != null && line.days[short] !== "") return line.days[short];
      if (line.days[full] != null && line.days[full] !== "") return line.days[full];
      if (line.days[di] != null && line.days[di] !== "") return line.days[di];
    }
    if (line.dayValues && line.dayValues[di] != null && line.dayValues[di] !== "") return line.dayValues[di];
    if (line.dayTimes && line.dayTimes[di] != null) {
      var dt = line.dayTimes[di];
      if (typeof dt === "string") return dt;
      if (dt && (dt.start || dt.end)) return String(dt.start || "") + "-" + String(dt.end || "");
    }
    if (line[di] != null && typeof line[di] !== "object") return line[di];
    return "";
  }

  /**
   * Classify one Sun–Sat cell.
   * status: OFF | WORKING | UNKNOWN
   */
  function classifyDay(line, day) {
    var di = dayIndex(day);
    var raw = di >= 0 ? dayValueOf(line, di) : (day == null ? "" : day);
    var rawStr = raw == null ? "" : String(raw);
    var trimmed = rawStr.trim();
    var result = {
      raw: rawStr,
      status: "UNKNOWN",
      parsed: null,
      start: "",
      end: "",
      startMin: null,
      endMin: null,
      shift: "",
      source: ""
    };
    if (OFF_RE.test(trimmed)) {
      result.status = "OFF";
      result.source = "day-cell-off";
      return result;
    }
    var parsed = parseTime(trimmed);
    if (parsed) {
      result.status = "WORKING";
      result.parsed = parsed;
      result.start = parsed.start;
      result.end = parsed.end;
      result.startMin = parsed.startMin;
      result.endMin = parsed.endMin;
      result.shift = parsed.shift;
      result.source = "day-cell";
      return result;
    }
    var workingHint = WORK_RE.test(trimmed);
    if (workingHint || trimmed !== "") {
      var fb = rowStartEnd(line);
      if (workingHint) {
        result.status = "WORKING";
        if (fb) {
          result.parsed = fb;
          result.start = fb.start;
          result.end = fb.end;
          result.startMin = fb.startMin;
          result.endMin = fb.endMin;
          result.shift = fb.shift;
          result.source = "row-start-end";
        } else {
          result.source = "working-missing-time";
        }
        return result;
      }
      result.status = "UNKNOWN";
      result.source = "unrecognized";
      return result;
    }
    result.status = "UNKNOWN";
    result.source = "blank";
    return result;
  }

  function lineKey(line, index) {
    if (line && line.id != null && line.id !== "") {
      return "LINE-" + String(line.id).replace(/^LINE-/i, "");
    }
    if (line && line.lineCode) {
      var m = String(line.lineCode).match(/(\d+)/);
      if (m) return "LINE-" + m[1].padStart(3, "0");
    }
    var idx = index != null ? index + 1 : 1;
    return "LINE-" + String(idx).padStart(3, "0");
  }

  function lineDisplayName(line, index) {
    if (line && line.lineCode) return String(line.lineCode);
    if (line && line.n) return String(line.n);
    if (line && line.name) return String(line.name);
    if (line && line.Line) return String(line.Line);
    return lineKey(line, index).replace(/^LINE-/, "Line ");
  }

  function positionOf(line) {
    if (!line) return "";
    return line.position || line.Position || line.jobTitle || line["Job Title"] || line.title || line.ti || line.empClass || "";
  }

  function sexOf(line) {
    if (!line) return "";
    var x = line.sex != null ? line.sex : line.Sex != null ? line.Sex : line.x;
    if (x == null || x === "") return "";
    x = String(x).trim().toUpperCase();
    if (x === "F" || x === "FEMALE") return "F";
    if (x === "M" || x === "MALE") return "M";
    return x;
  }

  function toRotationRow(line, day, index, options) {
    options = options || {};
    var di = dayIndex(day);
    if (di < 0) return null;
    var cls = classifyDay(line, di);
    if (cls.status === "OFF") return null;
    if (cls.status !== "WORKING" || cls.startMin == null) return null;
    var loc = "";
    var needsPlacement = true;
    if (options.location) {
      loc = String(options.location);
      needsPlacement = !loc;
    } else if (options.placement) {
      var p = options.placement;
      loc = p.locKey || p.checkpoint || p.zone || p.lo || "";
      needsPlacement = !loc;
    }
    var pos = positionOf(line);
    var duty = options.duty || "";
    var title = pos;
    if (duty === "DFO" && pos) title = pos + "/DFO";
    else if (duty === "BAG" && pos) title = pos + "/BAG";
    else if (duty && !pos) title = duty;
    var notes = [DAY_SHORT[di]];
    if (options.placement && options.placement.modset) notes.push(options.placement.modset);
    var row = {
      k: lineKey(line, index),
      n: lineDisplayName(line, index),
      ti: title || pos || "",
      po: pos || "",
      lo: loc,
      d: "",
      dow: di,
      sh: cls.shift,
      s: cls.startMin,
      e: cls.endMin,
      x: sexOf(line),
      q: "",
      ab: [],
      tr: [],
      nt: notes,
      needsPlacement: needsPlacement,
      generation: 2,
      status: cls.status,
      sourceDayValue: cls.raw,
      timeSource: cls.source
    };
    if (options.placement && options.placement.teamId) row.teamId = options.placement.teamId;
    if (duty) row.duty = duty;
    if (pos) row.position = pos;
    return row;
  }

  function adapt(lines, day, options) {
    options = options || {};
    var di = dayIndex(day);
    var dayOfWeek = di >= 0 ? DAY_SHORT[di] : "";
    var rows = [];
    var skipped = [];
    if (!Array.isArray(lines) || di < 0) {
      return { schema: "rotation.day.v1", source: "blade.lines.v1", dayOfWeek: dayOfWeek, dayIndex: di, rows: rows, skipped: skipped };
    }
    lines.forEach(function (line, index) {
      var cls = classifyDay(line, di);
      if (cls.status === "OFF") {
        skipped.push({ index: index, line: lineDisplayName(line, index), key: lineKey(line, index), raw: cls.raw, reason: "off", status: "OFF" });
        return;
      }
      var locOpt = options.location;
      if (typeof options.locationFor === "function") locOpt = options.locationFor(line, di, index);
      var placeOpt = typeof options.placementFor === "function" ? options.placementFor(line, di, index) : null;
      var dutyOpt = options.duty || "";
      if (typeof options.dutyFor === "function") dutyOpt = options.dutyFor(line, di, index) || "";
      var row = toRotationRow(line, di, index, { location: locOpt, placement: placeOpt, duty: dutyOpt });
      if (!row) {
        skipped.push({
          index: index,
          line: lineDisplayName(line, index),
          key: lineKey(line, index),
          raw: cls.raw,
          reason: cls.status === "UNKNOWN" ? (cls.source === "blank" ? "blank-not-off" : "unrecognized-not-off") : "working-missing-time",
          status: cls.status
        });
        return;
      }
      rows.push(row);
    });
    return { schema: "rotation.day.v1", source: "blade.lines.v1", dayOfWeek: dayOfWeek, dayIndex: di, rows: rows, skipped: skipped };
  }

  function hasDayTimeColumns(line) {
    if (!line) return false;
    for (var i = 0; i < 7; i++) {
      if (parseTime(dayValueOf(line, i))) return true;
    }
    return false;
  }

  var Adapter = {
    adapt: adapt,
    toRotationRow: toRotationRow,
    parseTime: parseTime,
    classifyDay: classifyDay,
    rowStartEnd: rowStartEnd,
    dayIndex: dayIndex,
    dayName: dayName,
    dayValueOf: dayValueOf,
    lineKey: lineKey,
    lineDisplayName: lineDisplayName,
    positionOf: positionOf,
    sexOf: sexOf,
    hasDayTimeColumns: hasDayTimeColumns,
    DAY_SHORT: DAY_SHORT.slice(),
    OFF_RE: OFF_RE,
    WORK_RE: WORK_RE
  };

  global.BladeLinesAdapter = Adapter;
})(typeof window !== "undefined" ? window : this);

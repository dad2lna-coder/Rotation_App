/**
 * BLADE Lines → Rotation compact-row adapter
 * ==========================================
 * Boundary between BLADE's clean Lines model and Rotation's compact row model.
 *
 * BLADE Lines is NOT an employee roster. There is no Kronos/employee ID.
 * The internal key (e.g. LINE-001) is only for the application pipeline.
 *
 * Source fields (do not invent others):
 *   Line, Position / Job Title, Sex, Monday…Sunday
 *
 * Start/End/Shift come from the selected day's cell value (e.g. "0330-1400").
 * Date is not used at this stage (d = "").
 * Location is intentionally NOT solved here — F7 placement enriches lo.
 * Qualifications are not supplied (q = "").
 *
 * Pipeline:
 *   BLADE Lines → BladeLinesAdapter → Rotation rows → F7 placement → Rotation engine
 */
(function (global) {
  "use strict";

  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_FULL = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"
  ];
  var DAY_ALIASES = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6
  };

  /** Values that mean the line does not work that day. */
  var OFF_RE = /^(OFF|RDO|DAY\s*OFF|LEAVE|VAC|VACATION|NONE|X|-|—|–|\s*)$/i;

  /**
   * Normalize day selector to 0=Sun … 6=Sat.
   * Accepts numeric index, short name, or full name.
   */
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

  /**
   * Parse a free-form time token into minutes from midnight.
   * Supports: 0330, 03:30, 3:30, 3:30 AM, 2:00 PM, etc.
   * Returns null if unparseable.
   */
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

    // HH:MM or H:MM
    var colon = t.match(/^(\d{1,2}):(\d{2})$/);
    if (colon) {
      var h = parseInt(colon[1], 10);
      var mi = parseInt(colon[2], 10);
      if (h > 23 || mi > 59) return null;
      if (ampm === "pm" && h < 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      if (!ampm && h > 23) return null;
      return h * 60 + mi;
    }

    // Compact HHMM or HMM (e.g. 0330, 330, 1400)
    var digits = t.replace(/\D/g, "");
    if (digits.length === 3 || digits.length === 4) {
      var hh, mm;
      if (digits.length === 3) {
        hh = parseInt(digits.slice(0, 1), 10);
        mm = parseInt(digits.slice(1), 10);
      } else {
        hh = parseInt(digits.slice(0, 2), 10);
        mm = parseInt(digits.slice(2), 10);
      }
      if (mm > 59) return null;
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      if (!ampm && hh > 23) return null;
      return hh * 60 + mm;
    }

    return null;
  }

  /**
   * Parse a day-cell value into { startMin, endMin, start, end, shift, raw }.
   * Handles ranges like:
   *   0330-1400 | 03:30-14:00 | 3:30 AM-2:00 PM | 0330 - 1400
   * Cross-midnight: end < start → end += 1440 for internal use; display times stay normalized.
   * Returns null if the value is off/empty or cannot be parsed as a valid range.
   */
  function parseTime(value) {
    if (value == null) return null;
    var raw = String(value).trim();
    if (!raw || OFF_RE.test(raw)) return null;

    // Prefer an explicit range separator
    var parts = raw.split(/\s*[-\u2013\u2014]\s*/);
    if (parts.length < 2) {
      return null;
    }

    var startTok = parts[0].replace(/^[^\d]*/, "").trim();
    var endTok = parts[1].replace(/^[^\d]*/, "").trim();

    var startMin = parseOneTime(startTok);
    var endMin = parseOneTime(endTok);

    if (startMin == null || endMin == null) {
      var cleaned = raw.replace(/[^\d:apmAPM\s\-\u2013\u2014]/g, " ").trim();
      parts = cleaned.split(/\s*[-\u2013\u2014]\s*/);
      if (parts.length >= 2) {
        startMin = parseOneTime(parts[0].trim());
        endMin = parseOneTime(parts[1].trim());
      }
    }

    if (startMin == null || endMin == null) return null;

    var endInternal = endMin;
    if (endInternal <= startMin) endInternal += 1440;

    function fmt(m) {
      var n = ((m % 1440) + 1440) % 1440;
      var h = Math.floor(n / 60);
      var mi = n % 60;
      return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
    }

    var shift = startMin < 12 * 60 ? "AM" : "PM";

    return {
      startMin: startMin,
      endMin: endInternal,
      start: fmt(startMin),
      end: fmt(endMin),
      shift: shift,
      raw: raw
    };
  }

  /**
   * Read the day-cell value from a BLADE line object.
   * Supports multiple possible shapes:
   *   line.Monday / line.Mon / line.days.Mon / line.dayValues[1] / line[1]
   */
  function dayValueOf(line, di) {
    if (!line || di < 0 || di > 6) return "";
    var short = DAY_SHORT[di];
    var full = DAY_FULL[di];
    if (line[full] != null && line[full] !== "") return line[full];
    if (line[short] != null && line[short] !== "") return line[short];
    if (line[full.toLowerCase()] != null) return line[full.toLowerCase()];
    if (line[short.toLowerCase()] != null) return line[short.toLowerCase()];
    if (line.days && typeof line.days === "object") {
      if (line.days[short] != null) return line.days[short];
      if (line.days[full] != null) return line.days[full];
      if (line.days[di] != null) return line.days[di];
    }
    if (line.dayValues && line.dayValues[di] != null) return line.dayValues[di];
    if (line[di] != null && typeof line[di] !== "object") return line[di];
    return "";
  }

  /**
   * Stable internal line key — NOT a Kronos or employee ID.
   */
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
    var key = lineKey(line, index);
    return key.replace(/^LINE-/, "Line ");
  }

  function positionOf(line) {
    if (!line) return "";
    return (
      line.position ||
      line.Position ||
      line.jobTitle ||
      line["Job Title"] ||
      line.title ||
      line.ti ||
      line.empClass ||
      ""
    );
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

    var rawDay = dayValueOf(line, di);
    var parsed = parseTime(rawDay);

    if (!parsed) {
      if (OFF_RE.test(String(rawDay || "").trim()) || rawDay === "") {
        return null;
      }
      return null;
    }

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

    var po = "TDC";
    if (duty === "BAG") po = "BAG";
    else if (duty === "DFO") po = "DFO";
    else if (pos) po = pos;

    var notes = [];
    if (duty) notes.push(duty + " " + DAY_SHORT[di]);
    else notes.push(DAY_SHORT[di]);
    if (options.placement && options.placement.modset) {
      notes.push(options.placement.modset);
    }

    var row = {
      k: lineKey(line, index),
      n: lineDisplayName(line, index),
      ti: title || pos || "",
      po: po,
      lo: loc,
      d: "",
      dow: di,
      sh: parsed.shift,
      s: parsed.startMin,
      e: parsed.endMin,
      x: sexOf(line),
      q: "",
      ab: [],
      tr: [],
      nt: notes,
      needsPlacement: needsPlacement,
      generation: 2,
      sourceDayValue: parsed.raw
    };

    if (options.placement && options.placement.teamId) {
      row.teamId = options.placement.teamId;
    }
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
      return {
        schema: "rotation.day.v1",
        source: "blade.lines.v1",
        dayOfWeek: dayOfWeek,
        dayIndex: di,
        rows: rows,
        skipped: skipped
      };
    }

    lines.forEach(function (line, index) {
      var rawDay = dayValueOf(line, di);
      var rawStr = rawDay == null ? "" : String(rawDay).trim();

      if (!rawStr || OFF_RE.test(rawStr)) {
        skipped.push({
          index: index,
          line: lineDisplayName(line, index),
          key: lineKey(line, index),
          raw: rawStr,
          reason: !rawStr ? "empty" : "non-working"
        });
        return;
      }

      var locOpt = options.location;
      if (typeof options.locationFor === "function") {
        locOpt = options.locationFor(line, di, index);
      }
      var placeOpt = null;
      if (typeof options.placementFor === "function") {
        placeOpt = options.placementFor(line, di, index);
      }
      var dutyOpt = options.duty || "";
      if (typeof options.dutyFor === "function") {
        dutyOpt = options.dutyFor(line, di, index) || "";
      }

      var row = toRotationRow(line, di, index, {
        location: locOpt,
        placement: placeOpt,
        duty: dutyOpt
      });

      if (!row) {
        skipped.push({
          index: index,
          line: lineDisplayName(line, index),
          key: lineKey(line, index),
          raw: rawStr,
          reason: "unparseable-time"
        });
        return;
      }

      rows.push(row);
    });

    return {
      schema: "rotation.day.v1",
      source: "blade.lines.v1",
      dayOfWeek: dayOfWeek,
      dayIndex: di,
      rows: rows,
      skipped: skipped
    };
  }

  function hasDayTimeColumns(line) {
    if (!line) return false;
    for (var i = 0; i < 7; i++) {
      var v = dayValueOf(line, i);
      if (v && parseTime(v)) return true;
    }
    return false;
  }

  var Adapter = {
    adapt: adapt,
    toRotationRow: toRotationRow,
    parseTime: parseTime,
    dayIndex: dayIndex,
    dayName: dayName,
    dayValueOf: dayValueOf,
    lineKey: lineKey,
    hasDayTimeColumns: hasDayTimeColumns,
    DAY_SHORT: DAY_SHORT.slice(),
    OFF_RE: OFF_RE
  };

  global.BladeLinesAdapter = Adapter;
})(typeof window !== "undefined" ? window : this);

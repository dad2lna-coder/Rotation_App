/** Shift management — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.getShift = function (id) {
    return S.state.shifts.find(function (x) { return x.id === id; });
  };

  S.shiftBadge = function (id) {
    var i = S.state.shifts.findIndex(function (x) { return x.id === id; });
    return S.BADGES[(i >= 0 ? i : 0) % S.BADGES.length];
  };

  S.shiftLabel = function (s) {
    if (!s) return "—";
    return String(s.start).replace(":", "") + "-" + String(s.end).replace(":", "");
  };

  /**
   * Effective start/end for a shift on a given day of week (0=Sun…6=Sat).
   * Uses dayTimes override when present; otherwise base shift start/end.
   * Uses Luxon for parse/format when available.
   */
  S.getEffectiveShiftTimes = function (shiftId, dow) {
    var s = S.getShift(shiftId);
    if (!s) return { start: "00:00", end: "00:00", isOverride: false };
    var baseStart = s.start;
    var baseEnd = s.end;
    var key = String(dow);
    if (s.dayTimes && s.dayTimes[key] &&
        S.isValidTimeText(s.dayTimes[key].start) &&
        S.isValidTimeText(s.dayTimes[key].end)) {
      return {
        start: s.dayTimes[key].start,
        end: s.dayTimes[key].end,
        isOverride: true
      };
    }
    return { start: baseStart, end: baseEnd, isOverride: false };
  };

  S.shiftHasDayOverrides = function (shiftId) {
    var s = S.getShift(shiftId);
    return !!(s && s.dayTimes && Object.keys(s.dayTimes).length);
  };

  S.shiftCoversSlot = function (shiftId, slotStart, dow) {
    var times = (dow != null) ? S.getEffectiveShiftTimes(shiftId, dow) : null;
    var s = S.getShift(shiftId);
    if (!s && !times) return false;
    var a = S.timeToMin(times ? times.start : s.start);
    var b = S.timeToMin(times ? times.end : s.end);
    return slotStart >= a && slotStart < b;
  };

  S.shiftOverlapsWindow = function (s, openMin, closeMin) {
    if (!s) return false;
    var a = S.timeToMin(s.start);
    var b = S.timeToMin(s.end);
    return a < closeMin && b > openMin;
  };

  S.targetWorkDays = function (shiftId, empClass) {
    if (empClass === "STSO" || empClass === "LTSO") {
      var s0 = S.getShift(shiftId);
      return s0 && (+s0.paid || 8) >= 10 ? 4 : 5;
    }
    var s = S.getShift(shiftId);
    if (s && (+s.paid || 8) >= 10) return 4;
    if (empClass === "PT") return 3;
    return 5;
  };

  S.consecutiveRdos = function (count, start) {
    var n = Math.max(2, Math.min(3, count || 2));
    var out = [];
    for (var i = 0; i < n; i++) out.push((start + i) % 7);
    return out;
  };

  S.rdoCountForShift = function (shift, empClass) {
    var work = S.targetWorkDays(shift && shift.id, empClass || "FT");
    return Math.max(1, 7 - work);
  };

  S.normalizeShift = function (raw, index) {
    var fallbackId = "S" + (index + 1);
    var id = raw && raw.id ? String(raw.id) : fallbackId;
    var name = raw && raw.name ? String(raw.name) : id;
    var start = raw && S.isValidTimeText(raw.start) ? raw.start : "08:00";
    var end = raw && S.isValidTimeText(raw.end) ? raw.end : "16:30";
    var paid = S.safeNumber(raw && raw.paid, 8, 1, 24);
    var force = Math.floor(S.safeNumber(raw && raw.force, 0, 0, null));
    var ltsoForce = Math.floor(S.safeNumber(raw && raw.ltsoForce, 0, 0, null));
    var stsoForce = Math.floor(S.safeNumber(raw && raw.stsoForce, 0, 0, null));
    var rdoHard = Array.isArray(raw && raw.rdoHard)
      ? raw.rdoHard.map(Number).filter(function (x) {
          return Number.isInteger(x) && x >= 0 && x <= 6;
        })
      : [];
    // Per-day start/end overrides: { "0": {start, end}, ... } — only days that differ from base
    var dayTimes = null;
    if (raw && raw.dayTimes && typeof raw.dayTimes === "object") {
      dayTimes = {};
      for (var k in raw.dayTimes) {
        if (!Object.prototype.hasOwnProperty.call(raw.dayTimes, k)) continue;
        var dt = raw.dayTimes[k];
        if (dt && S.isValidTimeText(dt.start) && S.isValidTimeText(dt.end)) {
          dayTimes[String(k)] = { start: dt.start, end: dt.end };
        }
      }
      if (!Object.keys(dayTimes).length) dayTimes = null;
    }
    var phase = (raw && raw.phase) || "auto";
    if (["auto", "opening", "am", "pm", "closing"].indexOf(phase) < 0) phase = "auto";
    return {
      id: id, name: name, start: start, end: end, paid: paid,
      force: force, ltsoForce: ltsoForce, stsoForce: stsoForce, rdoHard: rdoHard,
      dayTimes: dayTimes,
      phase: phase
    };
  };

  S.readShiftsFromDom = function () {
    var rows = document.querySelectorAll("#shifts-tbody tr[data-shift-id]");
    if (!rows.length) return;
    var next = [];
    rows.forEach(function (tr) {
      var id = tr.getAttribute("data-shift-id");
      var existing = S.getShift(id);
      var name = (tr.querySelector("[data-f=name]") && tr.querySelector("[data-f=name]").value.trim()) || id;
      var start = (tr.querySelector("[data-f=start]") && tr.querySelector("[data-f=start]").value) || "05:00";
      var end = (tr.querySelector("[data-f=end]") && tr.querySelector("[data-f=end]").value) || "13:30";
      var paid = +(tr.querySelector("[data-f=paid]") && tr.querySelector("[data-f=paid]").value);
      if (!paid || paid <= 0) {
        var mins = S.timeToMin(end) - S.timeToMin(start);
        paid = Math.max(1, Math.round((mins / 60) * 2) / 2);
      }
      var force = Math.max(0, Math.floor(+(tr.querySelector("[data-f=force]") && tr.querySelector("[data-f=force]").value) || 0));
      var ltsoForce = Math.max(0, Math.floor(+(tr.querySelector("[data-f=ltsoForce]") && tr.querySelector("[data-f=ltsoForce]").value) || 0));
      var stsoForce = Math.max(0, Math.floor(+(tr.querySelector("[data-f=stsoForce]") && tr.querySelector("[data-f=stsoForce]").value) || 0));
      var rdoHard = [];
      for (var d = 0; d < 7; d++) {
        var cb = tr.querySelector('[data-rdo="' + d + '"]');
        if (cb && cb.checked) rdoHard.push(d);
      }
      // Preserve per-day time overrides that live on the shift object
      var dayTimes = existing && existing.dayTimes ? existing.dayTimes : null;
      var phaseEl = tr.querySelector("[data-f=phase]");
      var phase = (phaseEl && phaseEl.value) || (existing && existing.phase) || "auto";
      next.push({
        id: id, name: name, start: start, end: end, paid: paid,
        force: force, ltsoForce: ltsoForce, stsoForce: stsoForce, rdoHard: rdoHard,
        dayTimes: dayTimes,
        phase: phase
      });
    });
    S.state.shifts = next;
  };

  S.rdoChecksHtml = function (selected) {
    var set = new Set((selected || []).map(Number));
    return S.DAYS.map(function (label, d) {
      return (
        '<label class="rdo-chk" title="' + label + '">' +
        '<input type="checkbox" data-rdo="' + d + '"' + (set.has(d) ? " checked" : "") + " />" +
        "<span>" + label.charAt(0) + "</span></label>"
      );
    }).join("");
  };

  S.renderShiftsTable = function () {
    var tbody = S.$("shifts-tbody");
    if (!tbody) return;
    tbody.innerHTML = S.state.shifts
      .map(function (s) {
        var hasDyn = S.shiftHasDayOverrides(s.id);
        var daysCls = hasDyn ? "btn btn-amber" : "btn";
        var daysTitle = hasDyn ? "Has per-day time overrides" : "Set different start/end per day of week";
        return (
          '<tr data-shift-id="' + s.id + '">' +
          '<td><input type="text" data-f="name" value="' + String(s.name).replace(/"/g, "&quot;") + '" style="width:5.5rem" /></td>' +
          '<td><input type="time" data-f="start" value="' + s.start + '" /></td>' +
          '<td><input type="time" data-f="end" value="' + s.end + '" /></td>' +
          '<td><select data-f="phase">' +
            '<option value="auto"' + ((s.phase || "auto") === "auto" ? " selected" : "") + '>Auto</option>' +
            '<option value="opening"' + (s.phase === "opening" ? " selected" : "") + '>Opening</option>' +
            '<option value="am"' + (s.phase === "am" ? " selected" : "") + '>AM</option>' +
            '<option value="pm"' + (s.phase === "pm" ? " selected" : "") + '>PM</option>' +
            '<option value="closing"' + (s.phase === "closing" ? " selected" : "") + '>Closing</option>' +
          '</select></td>' +
          '<td><input type="number" data-f="paid" min="1" step="0.5" value="' + s.paid + '" style="width:4rem" /></td>' +
          '<td><input type="number" data-f="force" min="0" value="' + (s.force || 0) + '" style="width:4rem" title="TSO force" /></td>' +
          '<td><input type="number" data-f="ltsoForce" min="0" value="' + (s.ltsoForce || 0) + '" style="width:4rem" title="LTSO force" /></td>' +
          '<td><input type="number" data-f="stsoForce" min="0" value="' + (s.stsoForce || 0) + '" style="width:4rem" title="STSO force" /></td>' +
          '<td><div class="rdo-row">' + S.rdoChecksHtml(s.rdoHard) + "</div></td>" +
          '<td style="white-space:nowrap">' +
            '<button type="button" class="' + daysCls + '" data-day-times="' + s.id + '" title="' + daysTitle + '">Day times…</button> ' +
            '<button type="button" class="btn btn-red" data-remove="' + s.id + '">✕</button>' +
          '</td>' +
          "</tr>"
        );
      })
      .join("");

    tbody.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.readShiftsFromDom();
        var id = btn.getAttribute("data-remove");
        S.state.shifts = S.state.shifts.filter(function (s) { return s.id !== id; });
        S.renderShiftsTable();
      });
    });

    tbody.querySelectorAll("[data-day-times]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.readShiftsFromDom();
        S.openShiftDayTimesModal(btn.getAttribute("data-day-times"));
      });
    });
  };

  // ----- Per-shift, per-day start/end modal -----

  S._editingDayTimesShiftId = null;

  S.openShiftDayTimesModal = function (shiftId) {
    var s = S.getShift(shiftId);
    if (!s) return;
    S._editingDayTimesShiftId = shiftId;
    var modal = S.$("shift-day-times-modal");
    var title = S.$("shift-day-times-title");
    if (title) {
      title.textContent = "Day times for " + (s.name || s.id) + " (base " + s.start + "–" + s.end + ")";
    }
    var tbody = S.$("shift-day-times-tbody");
    if (!tbody) return;
    var days = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var dt = s.dayTimes || {};
    tbody.innerHTML = days.map(function (name, i) {
      var key = String(i);
      var ov = dt[key];
      var useOverride = !!(ov && ov.start && ov.end);
      var startVal = useOverride ? ov.start : s.start;
      var endVal = useOverride ? ov.end : s.end;
      return (
        "<tr data-dow=\"" + i + "\">" +
          "<td><strong>" + name + "</strong></td>" +
          "<td><label class=\"rdo-chk\" style=\"flex-direction:row;gap:0.35rem\">" +
            "<input type=\"checkbox\" data-sdt=\"use\" " + (useOverride ? "checked" : "") + "> Override</label></td>" +
          "<td><input type=\"time\" data-sdt=\"start\" value=\"" + startVal + "\" step=\"900\" " + (useOverride ? "" : "disabled") + "></td>" +
          "<td><input type=\"time\" data-sdt=\"end\" value=\"" + endVal + "\" step=\"900\" " + (useOverride ? "" : "disabled") + "></td>" +
          "<td class=\"muted\" data-sdt=\"dur\"></td>" +
        "</tr>"
      );
    }).join("");
    S.updateShiftDayTimesDurations();
    if (modal) {
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
    }
  };

  S.closeShiftDayTimesModal = function () {
    var modal = S.$("shift-day-times-modal");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    S._editingDayTimesShiftId = null;
  };

  S.updateShiftDayTimesDurations = function () {
    var rows = document.querySelectorAll("#shift-day-times-tbody tr[data-dow]");
    rows.forEach(function (tr) {
      var use = tr.querySelector("[data-sdt=use]");
      var startEl = tr.querySelector("[data-sdt=start]");
      var endEl = tr.querySelector("[data-sdt=end]");
      var durEl = tr.querySelector("[data-sdt=dur]");
      if (!use || !startEl || !endEl || !durEl) return;
      startEl.disabled = !use.checked;
      endEl.disabled = !use.checked;
      if (!use.checked) {
        durEl.textContent = "base";
        durEl.style.color = "var(--muted)";
        return;
      }
      var o = S.timeToMin(startEl.value);
      var c = S.timeToMin(endEl.value);
      if (c <= o) {
        durEl.textContent = "Invalid";
        durEl.style.color = "var(--red)";
      } else {
        var mins = c - o;
        var h = Math.floor(mins / 60);
        var m = mins % 60;
        durEl.textContent = h + "h" + (m ? " " + m + "m" : "");
        durEl.style.color = "";
      }
    });
  };

  S.saveShiftDayTimes = function () {
    var shiftId = S._editingDayTimesShiftId;
    var s = S.getShift(shiftId);
    if (!s) {
      S.closeShiftDayTimesModal();
      return;
    }
    var rows = document.querySelectorAll("#shift-day-times-tbody tr[data-dow]");
    var dayTimes = {};
    rows.forEach(function (tr) {
      var i = tr.getAttribute("data-dow");
      var use = tr.querySelector("[data-sdt=use]");
      var startEl = tr.querySelector("[data-sdt=start]");
      var endEl = tr.querySelector("[data-sdt=end]");
      if (!use || !use.checked || !startEl || !endEl) return;
      if (!S.isValidTimeText(startEl.value) || !S.isValidTimeText(endEl.value)) return;
      if (S.timeToMin(endEl.value) <= S.timeToMin(startEl.value)) return;
      // Only store if different from base
      if (startEl.value === s.start && endEl.value === s.end) return;
      dayTimes[String(i)] = { start: startEl.value, end: endEl.value };
    });
    s.dayTimes = Object.keys(dayTimes).length ? dayTimes : null;
    S.closeShiftDayTimesModal();
    S.renderShiftsTable();
    S.updateStatus(
      "Updated day times for " + (s.name || s.id) +
      (s.dayTimes ? " (" + Object.keys(s.dayTimes).length + " day override(s))" : " (all days use base)")
    );
    if (S.renderAll) S.renderAll();
  };

  S.initShiftDayTimes = function () {
    var closeBtn = S.$("shift-day-times-close");
    if (closeBtn) closeBtn.addEventListener("click", S.closeShiftDayTimesModal);
    var cancelBtn = S.$("btn-sdt-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", S.closeShiftDayTimesModal);
    var saveBtn = S.$("btn-sdt-save");
    if (saveBtn) saveBtn.addEventListener("click", S.saveShiftDayTimes);
    var clearBtn = S.$("btn-sdt-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var rows = document.querySelectorAll("#shift-day-times-tbody tr[data-dow]");
        var s = S.getShift(S._editingDayTimesShiftId);
        rows.forEach(function (tr) {
          var use = tr.querySelector("[data-sdt=use]");
          var startEl = tr.querySelector("[data-sdt=start]");
          var endEl = tr.querySelector("[data-sdt=end]");
          if (use) use.checked = false;
          if (startEl && s) startEl.value = s.start;
          if (endEl && s) endEl.value = s.end;
        });
        S.updateShiftDayTimesDurations();
      });
    }
    document.addEventListener("change", function (e) {
      if (!e.target) return;
      var attr = e.target.getAttribute("data-sdt");
      if (attr === "use" || attr === "start" || attr === "end") {
        if (attr === "use") {
          var tr = e.target.closest("tr");
          var s = S.getShift(S._editingDayTimesShiftId);
          if (tr && s && !e.target.checked) {
            var startEl = tr.querySelector("[data-sdt=start]");
            var endEl = tr.querySelector("[data-sdt=end]");
            if (startEl) startEl.value = s.start;
            if (endEl) endEl.value = s.end;
          }
        }
        S.updateShiftDayTimesDurations();
      }
    });
    var modal = S.$("shift-day-times-modal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) S.closeShiftDayTimesModal();
      });
    }
  };
})(window.Scheduler);

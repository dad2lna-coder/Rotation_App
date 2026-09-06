/** Utility helpers — classic script (uses global dayjs when present) */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.$ = function (id) {
    return document.getElementById(id);
  };

  S.timeToMin = function (t) {
    if (!t || typeof t !== "string") return 0;
    var p = t.split(":");
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  };

  S.minToTime = function (m) {
    var normalized = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(normalized / 60);
    var mm = normalized % 60;
    return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  };

  S.safeNumber = function (value, fallback, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    if (typeof min === "number") n = Math.max(min, n);
    if (typeof max === "number") n = Math.min(max, n);
    return n;
  };

  S.isValidTimeText = function (value) {
    return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
  };

  S.setInputValue = function (id, value) {
    var el = S.$(id);
    if (el != null && value != null) el.value = value;
  };

  S.updateStatus = function (msg) {
    var el = S.$("status");
    if (el) el.textContent = msg;
  };

  /** dayjs global from lib/dayjs.min.js */
  S.dj = function () {
    if (typeof dayjs !== "function") throw new Error("dayjs is not loaded");
    return dayjs.apply(null, arguments);
  };

  S.parseStartDate = function (val) {
    if (!val) return S.dj().startOf("day");
    if (typeof val === "string") return S.dj(val.slice(0, 10)).startOf("day");
    return S.dj(val).startOf("day");
  };

  S.toDateInputValue = function (d) {
    return S.dj(d).format("YYYY-MM-DD");
  };
})(window.Scheduler);

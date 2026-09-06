/** Shared constants — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";
  S.DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  S.BADGES = ["badge-open", "badge-am", "badge-pm", "badge-close", "badge-4x10"];
  S.defaultShifts = function () {
    return [
      { id: "S1", name: "0330", start: "03:30", end: "12:00", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
      { id: "S2", name: "0400", start: "04:00", end: "12:30", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
      { id: "S3", name: "1230", start: "12:00", end: "20:30", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
      { id: "S4", name: "1430", start: "14:30", end: "23:00", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
      { id: "S5", name: "4×10", start: "10:30", end: "20:00", paid: 10, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [2, 3, 6] }
    ];
  };
})(window.Scheduler);

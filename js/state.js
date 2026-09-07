/** Application state — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";
  S.state = {
    open: "03:30",
    close: "23:00",
    useDynamicHours: false,
    dayHours: null, // filled by ensureDayHours() — 7× {open, close}
    startDate: null,
    weekCount: 1,
    ftM: 10,
    ftF: 10,
    ptM: 4,
    ptF: 4,
    ltsoM: 1,
    ltsoF: 1,
    stsoM: 2,
    stsoF: 2,
    // Secondary certifications (assigned after lines exist; not part of coverage gen)
    certDfoMax: 0,
    certPaxMax: 0,
    certBagMax: 0,
    certDfoEnabled: true,
    certBagEnabled: true,
    // Function coverage bands — set in Function Coverage modal
    functionRotation: {},
    functionCoverage: {
      enableDfo: true,
      enableBag: true,
      enablePax: false,
      bands: [
        { start: "03:30", end: "04:00", stso: 1, ltso: 1, tso: 1, dfo: 1, bag: 0, pax: 0 },
        { start: "04:00", end: "20:30", stso: 1, ltso: 1, tso: 6, dfo: 2, bag: 1, pax: 0 },
        { start: "20:30", end: "23:00", stso: 1, ltso: 1, tso: 3, dfo: 1, bag: 0, pax: 0 }
      ]
    },
    shifts: S.defaultShifts(),
    lines: [],
    schedule: {},
    issues: [],
    mode: "—"
  };
  S.shiftSeq = 6;
})(window.Scheduler);

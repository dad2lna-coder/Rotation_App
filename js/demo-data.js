window.RB_DEMO = { roster: [], meta: { file: "(off)", rows: 0, when: "off", dates: [], unknown: {}, locs: {} }, proj: {}, projMeta: {} };
try { indexedDB.deleteDatabase("rotationBuilder"); } catch (e) {}
(function () {
  ["js/lines-schema.js?v=20260906z", "js/f7-placement.js?v=20260906z", "js/f7-staff-fallback.js?v=20260906z", "js/f7-roster-map.js?v=20260906z"].forEach(function (src) {
    if (document.querySelector('script[src^="' + src.split("?")[0] + '"]')) return;
    var s = document.createElement("script");
    s.src = src;
    document.body ? document.body.appendChild(s) : document.head.appendChild(s);
  });
})();

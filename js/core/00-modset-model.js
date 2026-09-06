/* Shared mod-set shape for the BLADE merge.
   Rotation locations already use this. BLADE Airfield should store the same.
   Classic script — window.Rotation
*/
window.Rotation = window.Rotation || {};
(function (R) {
  "use strict";

  R.lane = function (n, ct) {
    return { n: n, ct: ct ? 1 : 0 };
  };

  R.modSet = function (opts) {
    opts = opts || {};
    return {
      id: opts.id || null,
      name: opts.name || "",
      lanes: (opts.lanes || []).map(function (l, i) {
        if (typeof l === "number") return R.lane(l, 0);
        return R.lane(l.n != null ? l.n : i + 1, l.ct);
      }),
      program: opts.program || "STD",
      open: opts.open || opts.startTime || "",
      close: opts.close || opts.endTime || ""
    };
  };

  R.checkpoint = function (opts) {
    opts = opts || {};
    return {
      id: opts.id || opts.name || "",
      t: opts.t || opts.terminal || "",
      open: opts.open || "04:00",
      close: opts.close || "20:00",
      mods: opts.mods || [],
      kcm: opts.kcm || null,
      exit: opts.exit || { am: 0, pm: 0 }
    };
  };

  R.locationToModSets = function (locId, loc) {
    if (!loc) return [];
    return (loc.mods || []).map(function (lanes, i) {
      return R.modSet({
        id: locId + "-MS" + (i + 1),
        name: locId + " Modset " + (i + 1),
        lanes: lanes,
        open: loc.open,
        close: loc.close
      });
    });
  };
})(window.Rotation);

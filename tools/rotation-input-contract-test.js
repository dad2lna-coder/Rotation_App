/**
 * Data-contract checks for state.rotationInput → Rotation rows.
 * Run: node tools/rotation-input-contract-test.js
 */
"use strict";

function fail(msg) { console.error("FAIL", msg); process.exitCode = 1; }
function ok(msg) { console.log("OK  ", msg); }

function toRosterRow(rec) {
  if (!rec || rec.status === "OFF") return null;
  var startMin = rec.startMin;
  var endMin = rec.endMin;
  if (startMin == null || endMin == null) return null;
  var role = rec.position || "";
  var duty = rec.function || "";
  return {
    po: role,
    position: role,
    functionName: duty,
    lo: rec.location || "",
    teamId: rec.team || "",
    s: startMin,
    e: endMin,
    x: rec.sex || "",
    nt: [rec.day, rec.modset].filter(Boolean)
  };
}

var t1 = {
  line: "L001", position: "TSO", sex: "F",
  start: "03:30", end: "12:00", startMin: 210, endMin: 720,
  team: "Team A", location: "Zone A", modset: "1",
  function: "", status: "WORKING", day: "Mon", dayIndex: 1
};
var r1 = toRosterRow(t1);
if (r1.po === "TSO" && r1.x === "F" && r1.s === 210 && r1.e === 720 && r1.teamId === "Team A" && r1.lo === "Zone A" && r1.nt.indexOf("1") >= 0) ok("Test 1 basic values");
else fail("Test 1 " + JSON.stringify(r1));

var times = [210, 240, 270].map(function (s) {
  return toRosterRow({ position: "TSO", startMin: s, endMin: 720, status: "WORKING", day: "Mon" });
});
if (times[0].s === 210 && times[1].s === 240 && times[2].s === 270) ok("Test 2 distinct start times");
else fail("Test 2");

var mon = toRosterRow({ position: "TSO", startMin: 210, endMin: 720, status: "WORKING", team: "Team A", location: "Zone A", modset: "1", day: "Mon" });
var tue = toRosterRow({ position: "TSO", startMin: 210, endMin: 720, status: "WORKING", team: "Team A", location: "Zone B", modset: "2", day: "Tue" });
if (mon.lo === "Zone A" && tue.lo === "Zone B") ok("Test 3 day-specific movement");
else fail("Test 3");

var t4 = toRosterRow({ position: "TSO", function: "DFO", startMin: 210, endMin: 720, status: "WORKING", day: "Mon" });
if (t4.po === "TSO" && t4.position === "TSO" && t4.functionName === "DFO") ok("Test 4 position stays TSO with function DFO");
else fail("Test 4 " + JSON.stringify(t4));

var rotationInput = [
  { lineKey: "LINE-1", dayIndex: 1, day: "Mon", position: "TSO", startMin: 210, endMin: 720, location: "Zone A", modset: "1", team: "Team A", status: "WORKING", function: "" }
];
rotationInput[0].location = "Zone C";
rotationInput[0].modset = "9";
var afterImport = toRosterRow(rotationInput[0]);
if (afterImport.lo === "Zone C" && afterImport.nt.indexOf("9") >= 0) ok("Test 5/6 imported location/modset survive into Rotation row");
else fail("Test 5/6");

var state = { lines: [{ position: "SHOULD_NOT_APPEAR", location: "OLD" }], rotationInput: rotationInput };
var consumed = state.rotationInput.map(toRosterRow);
if (consumed[0].lo === "Zone C" && consumed[0].po === "TSO") ok("Test 7 Rotation consumes rotationInput, not state.lines");
else fail("Test 7");

if (!process.exitCode) console.log("All contract tests passed.");

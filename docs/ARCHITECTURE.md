# Rotation Builder Architecture Map

## Runtime

Classic scripts. Load order matters.

## Persistence

IndexedDB database `rotationBuilder`, object store `kv`.
Roster keys: `roster`, `rosterMeta`.

## BLADE Lines → Rotation / F7 integration

```text
BLADE Lines
    ↓
blade-lines-adapter.js          normalize only (no invented TDC / BAG / DFO / location)
    ↓
intermediate line-day model
    ↓
F7 placement                    day-specific Team / Location / Modset (Home is not permanent)
    ↓
function assignment (optional)  explicit "Assign DFO / BAG days" — not a side effect of generate
    ↓
blade-interchange.js            debug + interchange XLSX (export / edit / import)
    ↓
blade-rotation-bridge.js
    ↓
Rotation engine
```

### BLADE owns

Line, Position / Job Title, Sex, Monday–Sunday day cells.

BLADE does not assign TDC, BAG, DFO, qualifications, employee IDs, or operational location.

### Adapter

Translates only. `po` is the source Position. Empty stays empty. OFF/RDO/unparseable times are skipped or validated, never guessed.

### F7

Day-specific location and Modset. A team can be Zone A Monday and Zone B Tuesday.

### Function assignment

Separate explicit stage (`generateFunctionAssignments` / Assign DFO / BAG days).
BAG/DFO appear only when that stage (or an interchange edit) assigned them.

### Interchange workbook

Export Debug / Interchange Workbook and Import Debug / Interchange Workbook.
Uses `js/vendor/xlsx.js`.

Tabs: Summary, Sunday–Saturday, Placement, Function, Validation, Raw_BLADE.

Day tabs are the intermediate rows Rotation will consume.

Canonical state is `Scheduler.state.rotationInput` (source in `rotationInputSource`).
Interchange import writes that array and sets source to `interchange`.
`pushLinesToRotation` consumes `rotationInput` only; it does not rebuild from `state.lines`.
Overlay, if present, is applied into `rotationInput` before Rotation sees it.

Missing Position, time, Team, Location, Modset, or duplicates go on the Validation tab.

### Forbidden

`po: duty === "BAG" ? "BAG" : duty === "DFO" ? "DFO" : "TDC"`

Auto-running function assignment inside generate/translate.

## Future true-module architecture

Split domain / ingestion / solver / state / ui / export only with tests. Do not heroic-refactor the shared globals in one pass.

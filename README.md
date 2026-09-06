# Rotation Builder

Offline checkpoint rotation sheet builder.

Gold working copy (do not edit as the merge source of truth):

`original_file/RotationBuilder 1.html`

Live original: https://dad2lna-coder.github.io/Rotation_App/original_file/RotationBuilder%201.html

## Modular app (BLADE-style)

Open `index.html`. Scripts are classic tags in load order, same pattern as BLADE_Alpha:

```
lib/dayjs.min.js          # from BLADE
js/vendor/xlsx.js         # roster/projection ingest (SheetJS)
js/core/01-foundation.js  # time, config, IndexedDB
js/core/02-roster.js      # workbook → officers
js/core/03-projections.js # demand → lanes
js/engine/04-engine.js    # seats, rings, solve, breaks
js/ui/05-state-render.js  # state + sheet + export
js/ui/06-config-boot.js   # config UI + boot
js/adapter-blade.js       # BLADE JSON → Rotation roster rows
```

Re-extract from the gold HTML:

```
python3 tools/extract_js.py
```

## BLADE handshake

`Rotation.rosterFromBlade(bladeExportJson, { location, startDate })` turns BLADE lines + schedule into one roster row per working day. Quals are empty until BLADE stores them.

Debug handle: `window.RB` and `window.Rotation`.

# Rotation Builder

Offline checkpoint rotation sheet builder.

Gold working copy: `original_file/RotationBuilder 1.html`

## Step 2 (current)

- Seat eligibility uses bid-line function (PAX / DFO / BAG). Letter quals paused.
- BAG lines stay out of the checkpoint ring.
- Generate this day or the Sun–Sat week around the selected date.
- Shared mod-set model in `js/core/00-modset-model.js` — this is the structure BLADE should store.

`Rotation.rosterFromBlade(payload, { location, startDate })` maps BLADE lines to roster rows.

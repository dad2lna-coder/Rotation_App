# Rotation Builder Evaluation

## Source

`RotationBuilder 1.html.txt`

The supplied source is a single-file offline browser application containing HTML, CSS, an embedded SheetJS/XLSX implementation, and the Rotation Builder application logic. The original source is 821,962 characters across 3,707 lines.

The application JavaScript outside the embedded spreadsheet library is approximately 125,782 characters and contains 101 unique named function declarations.

## Architecture found

### Foundation
Defaults, configuration, IndexedDB persistence, time/date/location helpers, seeded RNG, DOM helpers, and common UI utilities.

### Roster
Workbook ingestion and normalization plus Remarks parsing.

### Projections
Projection workbook ingestion and conversion to hourly/per-column lane demand.

### Engine
Sheet window creation, staff selection, seats, modsets/rings, eligibility, assignment passes, breaks, coverage, qualification checks, and diagnostics.

### Rendering/export
Application state, sheet rendering, diagnostics, manual-edit presentation, Excel/CSV/print export.

### UI
Themes, officer editing, configuration UI, persistence controls, import/export, and bootstrap.

## Strengths

- Fully client-side/offline-oriented.
- Embedded spreadsheet parser avoids CDN dependency.
- Configuration is substantially data-driven.
- Seeded randomization supports reproducible generation.
- Diagnostics are explicit rather than silently hiding unmet constraints.
- Manual edits are part of the operating model.
- IndexedDB provides local persistence.

## Structural weaknesses

1. The embedded spreadsheet library dominates file size.
2. Application logic is globally scoped.
3. State, domain rules, solver behavior, rendering, and UI are coupled.
4. There is no automated test suite in the supplied source.
5. DOM element IDs are a major integration surface.
6. `window.RB` exposes a broad support/debug surface.
7. The stylesheet contains later fix-up rules, including repeated off-shift visual rules, indicating iterative accumulation.

## Important distinction

Moving the code into folders does not make it truly modular. This package intentionally preserves the original global execution model to minimize behavioral risk.

A future modernization should introduce real module boundaries, explicit imports/exports, a domain model, isolated solver logic, and automated regression tests. That should be a separate project from this structural decomposition.

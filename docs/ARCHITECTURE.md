# Rotation Builder Architecture Map

## Runtime

```text
index.html
  |
  +-- css/styles.css
  |
  +-- js/vendor/xlsx.js
  |
  +-- core/01-foundation.js
  +-- core/02-roster.js
  +-- core/03-projections.js
  |
  +-- engine/04-engine.js
  |
  +-- ui/05-render.js
  +-- ui/06-theme.js
  +-- ui/07-editing.js
  +-- ui/08-config-ui.js
```

Scripts intentionally remain classic scripts and must load in this order because the original application shares state and functions across sections.

## Data flow

```text
Roster workbook
   |
   v
mapped columns
   |
   v
normalized staff
   |
   v
eligible staff for date/location/shift
   |
   +-------------------+
                       |
Projection workbook    |
   |                   |
   v                   |
hourly demand ---------+
   |
   v
sheet window
   |
   v
modsets/rings + seats
   |
   v
eligibility and assignment passes
   |
   v
break scheduling
   |
   v
coverage / qualification / gender validation
   |
   v
diagnostics
   |
   v
rendered rotation sheet
   |
   +--> manual edits
   +--> Excel
   +--> CSV
   +--> print
```

## Configuration

The default configuration contains:

- `rules`
- `positions`
- `quals`
- `qualMap`
- `ctQual`
- `locations`
- `titles`
- `colmap`
- `aliases`
- `proj`
- `restrictions`

### Default position families

| Family | Label | Scope | Seats |
|---|---|---|---:|
| T | TDC | lane | 1 |
| D | Divest | lane | 1 |
| P | PSO | lane | 1 |
| X | X-ray | lane | 1 |
| SO | Body Scanner | mod | 2 |
| M | WTMD | mod | 1 |
| KCM | KCM | site | 1 |
| EXIT | Exit Lane | site | 1 |

## Rotation engine concepts

The engine uses a configured ring order to determine the rotation sequence. Body Scanner has two seats, represented internally as `SO-A` and `SO-B`.

The configuration exposes controls for:

- slot length
- AM/PM seam
- female count per modset
- break targets/max
- second-break timing
- lane-close threshold
- repeat behavior
- break history behavior
- female scaling
- sole-eligible pinning
- strict shift matching
- shortfall drop order
- ring order

## Roster model

The configurable roster mapping reads:

```text
KronosID
EmployeeName
Job Title
Position
Location
Shift
Start
End
Sex
Quals
Date
Remarks
```

The actual workbook headers can be changed through Configuration without changing the core source.

## Projection model

The projection configuration maps:

```text
Date
Terminal
Checkpoint
Metrics
Sum of Value
Hour of Day
```

It supports Standard-only, Standard + PreCheck combined, and separate Standard/PreCheck demand modes.

## Persistence

The source defines an IndexedDB database named:

```text
rotationBuilder
```

with a `kv` object store and simple get/set/delete/key operations.

## UI

### Build Sheet
- roster upload
- passenger projections
- date
- terminal/location
- shift and seed
- sheet-window override
- active lanes
- roster changes
- saved sheets
- generate/reroll/re-solve
- Excel/CSV/print
- manual clearing
- diagnostics

### Configuration
- rotation rules
- job titles
- locations/lanes/modsets
- position codes
- qualifications
- projection settings
- column mapping
- location aliases
- persistent restrictions
- local data import/export/wipe

## Storage/export

The tool is browser-local. It does not use fetch/XHR networking in the supplied application code. The original CSP also disables network connections with `connect-src 'none'`.

Supported output/import paths include Excel, CSV, print, configuration JSON, and the application's full briefcase/configured-tool mechanisms.

## Debug surface

The source exposes `window.RB` with selected engine, rendering, ingestion, export, and editing functions. This is useful for support but is also a sign that the current application is not strongly encapsulated.

## Future true-module architecture

```text
domain/
  config
  models
  time
  locations
  qualifications

ingestion/
  workbook
  roster
  projections

solver/
  seats
  rings
  eligibility
  assignment
  breaks
  constraints
  diagnostics

state/
  store
  persistence

ui/
  shell
  sidebar
  sheet
  diagnostics
  configuration
  modals

export/
  csv
  xlsx
  print

vendor/
  xlsx
```

That future architecture should be introduced with regression tests rather than a heroic afternoon of moving functions around and discovering that civilization was built on implicit globals.

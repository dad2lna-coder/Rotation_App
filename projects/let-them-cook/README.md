# Let Them Cook — Workplace Improvement Initiative Tracker

Portable Windows app (Tauri v2) for the FACTTT shared folder. The dashboard UI is unchanged. **Refresh** and **Save** talk to disk through Rust — no daily Import/Export JSON dance.

## Architecture

**Frontend:** Vanilla JS modules (ES modules), no framework. Copy-only Tauri build.
**Backend:** Rust/Tauri v2 with 6 commands.
**Shared folder:** `data/initiatives.json` (never named master).

### Directory structure
```text
projects/let-them-cook/
├── index.html              # Shell + initiative list + section editor
├── css/style.css           # All styles
├── js/
│   ├── init.js             # Main entry point (module)
│   ├── stores/state.js     # App state, payload builder, metrics
│   ├── utils/strings.js    # escapeHtml, normalizeText
│   ├── utils/tauri.js      # isTauri, invokeCommand
│   ├── utils/ui.js         # showToast, toggleMoreActions
│   ├── data/schema.js      # SCHEMA_VERSION, isValidPayload
│   ├── data/migrations.js  # migrateToV3 (old→new schema)
│   ├── data/store.js       # collect/apply for ideas, tasks, questions, flow
│   └── components/         # InitiativeCard, SectionEditor, etc.
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/main.rs, lib.rs, commands.rs, paths.rs
│   ├── capabilities/, permissions/
│   └── icons/
├── examples/
│   ├── initiatives.json    # Empty example
│   └── submit.json         # Sample inbox submit
└── scripts/
    ├── prepare-frontend.js # Copy-only stage (unchanged)
    └── decode-icons.js     # Icons from base64 JSON
```

## Shared folder layout

```text
OneDrive - USTSA\
  FACTTT\
    LetThemCook.exe      ← portable; double-click, no install
    data\
      initiatives.json   ← shared source of truth
    inbox\
      submit-<ISO_TS>-<operator>.json
    archive\                      ← Power Automate moves processed submits here
```

Discovery order:
1. `FACTTT_ROOT` env var
2. Running exe under `FACTTT/`
3. `OneDrive - USTSA\FACTTT` (created if missing)

## Buttons

| Button | Effect |
|---|---|
| **Refresh** | Reads `data/initiatives.json`; also runs on exe start |
| **Save** | Writes current UI to `data/initiatives.json` AND `inbox/submit-….json` |
| **Import file…** | One-off merge/replace under More |
| **Print / Save as PDF** | Browser print dialog |

Greeting on exe load: `Hello, <Windows USERNAME>`.

## Build

On Windows (or GitHub Actions `windows-latest`):

```text
npm install
node scripts/decode-icons.js
node scripts/prepare-frontend.js
npm run tauri -- build
```

Primary artifact: `src-tauri/target/release/LetThemCook.exe`
Secondary: `src-tauri/target/release/bundle/nsis/LetThemCook_*_x64-setup.exe`

## Data model

```json
{
  "schema": "let-them-cook-dashboard",
  "schemaVersion": "3.0.0",
  "initiatives": [{
    "id": "init-1",
    "name": "NDO Movement",
    "status": "active",
    "owner": "",
    "startDate": "",
    "sections": [{
      "id": "sec-1",
      "type": "discovery",
      "name": "Discovery",
      "ideas": [...],
      "actions": [...],
      "questions": [],
      "flow": {
        "currentRecipients": [],
        "teamsNotification": [],
        "personnel": "",
        "notificationNeed": "",
        "movementPath": "",
        "status": "Discovery Needed"
      }
    }]
  }],
  "sharedNotes": ""
}
```

## Old schema migration

`migrations.js` exports `migrateToV3(payload)`. Old `{ movements: { ndo, training, tsst } }` → `{ initiatives: [{ id: "legacy", sections: [...] }] }`.

## Rust commands

| Command | Role |
|---|---|
| `get_operator` | Windows `USERNAME`, else `USER`, else `OPERATOR` |
| `shared_folder_path` | FACTTT root |
| `ensure_share_layout` | Create `data/`, `inbox/`, `archive/` |
| `read_dashboard` | Read `data/initiatives.json`; create starter if missing |
| `write_dashboard` | Write `data/initiatives.json` |
| `write_submit` | Write `inbox/submit-….json` |

## Tests

Rust unit tests in `src-tauri/src/paths.rs`:
- `prefers_ustsa_onedrive`
- `falls_back_to_first_onedrive_star`
- `ensure_creates_layout_and_starter_initiatives`
- `write_submit_does_not_rewrite_initiatives`
- `write_dashboard_replaces_share_file`
- `safe_operator_strips_path_chars`

Run with: `cd src-tauri && cargo test`

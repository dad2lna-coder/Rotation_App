# Operational Movements Discovery Dashboard

Portable Windows app (Tauri v2) for the FACTTT shared folder. The dashboard UI is unchanged. **Refresh** and **Save** talk to disk through Rust — no daily Import/Export JSON dance.

This is **not** BLADE staffing. There is no runtime dependency on BLADE_Alpha. OneDrive discovery is reimplemented in the same style.

## Shared folder layout

Drop the exe into (or let it create) this tree under the user's OneDrive:

```text
OneDrive - USTSA\
  FACTTT\
    OperationalMovements.exe      ← portable; double-click, no install
    data\
      dashboard.json              ← shared source of truth (never named master)
    inbox\
      submit-<ISO_TS>-<operator>.json
    archive\                      ← Power Automate moves processed submits here
```

Typical full path:

`C:\Users\<USERNAME>\OneDrive - USTSA\FACTTT`

Discovery order:

1. `FACTTT_ROOT` environment variable, if set
2. If the running exe already lives inside a folder named `FACTTT`, use that folder (portable drop-in)
3. Prefer `C:\Users\<USERNAME>\OneDrive - USTSA`, else the first `OneDrive*` folder under the user profile, then `FACTTT` (created if missing)

On first launch the app creates `data/`, `inbox/`, `archive/`, and — if it is absent — `data/dashboard.json`.

## What the buttons do

| Button | Effect |
|---|---|
| **Refresh** | Reads `data/dashboard.json` and loads the UI. Also runs automatically when the exe starts. |
| **Save** | Writes the current UI to **`data/dashboard.json`** (so Refresh/reopen keep your edits) **and** to `inbox/submit-<ISO_TS>-<operator>.json` for Power Automate. |
| **Import file…** | One-off merge/replace from a local JSON file (under More). |
| **Print / Save as PDF** | Browser print dialog. |

Greeting on exe load: `Hello, <Windows USERNAME>`.

Source of truth is `data/dashboard.json`. Browser localStorage is only an optional cache.

## Power Automate (recommended)

When a file is **created** in `FACTTT\inbox\`:

1. Parse the JSON
2. Merge into `FACTTT\data\dashboard.json` if you want a server-side merge (the app also writes `dashboard.json` on Save so the file is usable without Automate)
3. Post a Teams message (who saved, when, short summary)
4. Move the submit file to `FACTTT\archive\`

Do **not** name the shared file `master.json` or `master`.

Example empty dashboard: [`examples/dashboard.json`](examples/dashboard.json)  
Example inbox submit: [`examples/submit.json`](examples/submit.json)

## Build a Windows exe

WebView2 is assumed on target PCs (standard on Windows 10/11).

On a Windows machine (or GitHub Actions `windows-latest`), **install npm deps before any Tauri command**. A build without `npm ci` / `npm install` is a hard fail.

```text
npm ci
node scripts/decode-icons.js
npm run tauri -- build --bundles nsis
```

Safer equivalent invoke:

```text
npm ci
node scripts/decode-icons.js
npx tauri build --bundles nsis
```

`beforeBuildCommand` in `src-tauri/tauri.conf.json` already runs `node scripts/prepare-frontend.js`. Do not skip `npm ci` — `@tauri-apps/cli` lives in `devDependencies`.

Primary artifact (portable, no install):

`src-tauri/target/release/OperationalMovements.exe`

Copy that exe into `OneDrive - USTSA\FACTTT` and run it.

Secondary (optional) NSIS installer, current-user, no admin:

`src-tauri/target/release/bundle/nsis/OperationalMovements_*_x64-setup.exe`

### GitHub Action: Build Windows

Workflow: [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml) on branch `Side-Quest` (`workflow_dispatch` or push to watched paths).

Order that must not change:

1. checkout + setup-node 22
2. **Install npm deps** — `npm ci`
3. rust-toolchain + rust-cache
4. `node scripts/decode-icons.js`
5. `cargo test --lib --no-default-features` (in `src-tauri`)
6. `npm run tauri -- build --bundles nsis`
7. upload artifacts

Artifacts:

| Artifact | Path | Missing file |
|---|---|---|
| `OperationalMovements-portable` | `src-tauri/target/release/OperationalMovements.exe` | **error** (hard fail) |
| `OperationalMovements-nsis` | `src-tauri/target/release/bundle/nsis/*.exe` | warn |

Unsigned builds may show a SmartScreen warning on first run.

## Rust commands

| Command | Role |
|---|---|
| `get_operator` | Windows `USERNAME`, else `USER`, else `OPERATOR` |
| `shared_folder_path` | FACTTT root as a string |
| `read_dashboard` | Read `data/dashboard.json`; create the starter file if missing |
| `write_dashboard` | Write `data/dashboard.json` (Save / source of truth) |
| `write_submit` | Write `inbox/submit-….json` only; does not rewrite `dashboard.json` |
| `ensure_share_layout` | Create `data/`, `inbox/`, `archive/` (also on startup) |

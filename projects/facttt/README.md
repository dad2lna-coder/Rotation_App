# facttt

Side-quest share tooling on OneDrive.

- **Location:** `OneDrive - USTSA\FACTTT` (Windows side only)
- **Repo:** none yet — lives inside the Rotation_App build
- **Status:** active
- **OneDrive is reference-only:** it is the target for the final product, not present in this environment. Dev/testing uses the fake share below.

## Canonical folder structure

```text
OneDrive - USTSA\
  FACTTT\
    OperationalMovements.exe      ← portable; double-click, no install
    data\
      dashboard.json              ← shared source of truth (never "master")
    inbox\
      submit-<ISO_TS>-<operator>.json
    archive\                      ← Power Automate moves processed submits here
```

Full path: `C:\Users\<USERNAME>\OneDrive - USTSA\FACTTT`

Created on first launch if missing: `data/`, `inbox/`, `archive/`, and `data/dashboard.json`.

## Discovery order (in the app)

1. `FACTTT_ROOT` env var, if set
2. Running exe already inside a folder named `FACTTT` → use it (portable drop-in)
3. Prefer `C:\Users\<USERNAME>\OneDrive - USTSA`, else first `OneDrive*` under the user profile, then create `FACTTT`

## Dashboard contract

- `data\dashboard.json` is the source of truth — never name it `master`/`master.json`.
- Schema: `operational-movements-dashboard` v2.0.0, `version: 1`.
- Top-level: `items`, `sharedNotes`, `goals`, `objectives`, `movements` (`ndo`, `training`, `tsst` — each with `flow`, `ideas`, `actions`, `questions`).
- Save writes both `data/dashboard.json` and `inbox/submit-<ISO_TS>-<operator>.json`.
- Examples: `rotation_app/examples/dashboard.json`, `rotation_app/examples/submit.json`.

## Power Automate (recommended)

On file **created** in `FACTTT\inbox\`: parse → optionally merge into `data\dashboard.json` → Teams message → move submit to `archive\`.

## Dev harness (fake share)

`dev/make-fake-share.mjs` scaffolds a local stand-in tree and mirrors `rotation_app/src-tauri/src/paths.rs`:

- `ensure_share_layout_at()` → creates `data/`, `inbox/`, `archive/`, and starter `data/dashboard.json` only if absent.
- `write_submit_at()` → `inbox/submit-<iso_ts_file>-<safe_operator>.json`; never touches `dashboard.json`.
- Same starter shape (`let-them-cook-dashboard`, v2.0.0, `ndo`/`training`/`tsst`).

```bash
cd dev
node make-fake-share.mjs                 # scaffold dev/fake-share/FACTTT
node make-fake-share.mjs --submit JMoore # + sample inbox submit
node make-fake-share.mjs --reset         # wipe then scaffold
node make-fake-share.mjs --root /tmp/x/FACTTT
```

Then point the app at it: `FACTTT_ROOT=<abs path>`.

Refuses any `--root` containing `onedrive` so the real share can't be clobbered.
The generated tree (`dev/fake-share/`) is gitignored.

## Notes

- No live OneDrive mount on this Linux host (debian-dev). The share lives on James's Windows machine; there is no local checkout to browse.
- No cargo/rustc here either, so the Rust `#[cfg(test)]` suite can't run locally — the Node harness is the stand-in until a build box exists.

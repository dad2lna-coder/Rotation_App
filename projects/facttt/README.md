# facttt

Side-quest share tooling on OneDrive.

- **Location:** `OneDrive - USTSA\FACTTT` (Windows side only)
- **Repo:** none yet — lives inside the Rotation_App build
- **Status:** active

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

## Notes

- No live OneDrive mount on this Linux host (debian-dev). The share lives on James's Windows machine; there is no local checkout to browse.
- Local device testing is possible by pointing `FACTTT_ROOT` at a scaffolded fake tree.

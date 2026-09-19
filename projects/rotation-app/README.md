# rotation-app

Operational Movements / **Let Them Cook** Tauri app + dashboard.

- **Repo:** https://github.com/dad2lna-coder/Rotation_App <!-- project: path:/root/.openclaw/workspace/let-them-cook -->
- **Branch:** `Side-Quest`
- **Checkout:** `../../rotation_app` (workspace root, not duplicated here)
- **Ship style:** portable no-install exe; Refresh/Save via Rust file I/O once wired.
- **Frontend:** `index.html` shell + `css/` + `js/` (tauri-bridge / state / UI / boot) — one extract per punchlist, no monolithic index.html long-term.
- **Status:** active — **in-progress modularization refactor** (not yet committed)

## WIP: modularization refactor (uncommitted in `rotation_app/`)

Working tree is mid-refactor. Synced to `origin/Side-Quest` at `b7854ef`; all changes below are uncommitted and being actively worked. **Do not commit or revert without James's say-so.**

- `index.html`: 84,026 → 32,833 bytes (~1,650 lines extracted into modules).
- New modules (untracked): `app.js`, `index.js`, `style.css`, `actions/data.js`,
  `components/{feedback,ideas,lists,navigation,progress}.js`,
  `stores/{dashboard,state}.js`, `utils/{strings,tauri,ui}.js`.
- Renames: `operational-movements` → `let-them-cook`, `OperationalMovements` → `LetThemCook`,
  window title → "Let Them Cook".
- Modified: `index.html`, `package.json`, `src-tauri/{Cargo.toml,lib.rs,main.rs,paths.rs,tauri.conf.json}`.

### Open gotcha

`.github/workflows/build-windows.yml` still uploads `OperationalMovements.exe` /
`OperationalMovements-nsis` and runs `cargo test --lib --no-default-features`, but
`tauri.conf.json` now builds `LetThemCook.exe`. Artifact upload will miss once this
pushes — fix the workflow exe name when the refactor lands.

### Stale clones

`/tmp/Rotation_App` and `/tmp/rotation-side-quest` are leftovers at `b7854ef`,
untouched by the refactor. `rotation_app/` is the live checkout.

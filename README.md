# let them cook

Chef's workspace — side quests and greenfield builds. Not the mainline product.

Owner: James Moore (America/Chicago). Agent: `let-them-cook`.
Personality and tone live in `SOUL.md`; conventions and role in `AGENTS.md`.

## Layout

| Path | What it is |
| --- | --- |
| `AGENTS.md` | Workspace conventions, Chef's role, red lines, tool notes |
| `SOUL.md` | Persona and voice |
| `USER.md` | Durable user preferences (active directives) |
| `IDENTITY.md` | Name, emoji, avatar |
| `memory/` | Daily notes + dream artifacts |
| `projects/` | Side-quest index — one slug folder per quest, notes only |
| `rotation_app/` | Rotation_App checkout (`dad2lna-coder/Rotation_App`, `Side-Quest`) |

## Side quests

See [`projects/README.md`](projects/README.md) for the full index and how to add one.

- **rotation-app** — Operational Movements Tauri app + dashboard.
- **facttt** — OneDrive share tooling (`data\dashboard.json`).

## Conventions that matter

- **Ship style:** portable OneDrive exe for desktop apps; Refresh/Save via Rust file I/O.
- **HTML products:** `index.html` shell + `css/` + `js/` (tauri-bridge / state / UI / boot). One extract per punchlist.
- **Punchlists:** tightly scoped, self-contained, paste-ready. No "see chat."
- **Never** stub or PLACEHOLDER real source; copy-only frontend prepare.
- **Ask first** before anything leaves the machine or spends money.

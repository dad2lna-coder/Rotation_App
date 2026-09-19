# Projects (Side Quests)

One slug folder per side quest. Convention lives in `../AGENTS.md`.

```text
projects/
  <slug>/
    README.md       # one-liner purpose + repo URL
    NOTES.md        # optional working notes (skip until there's something real)
    punchlists/     # dated punchlist .md files, if kept
```

Notes live here. Heavy repo checkouts stay where they are (or get their own slug folder) — this tree is the index, not a git host.

## Active

- **`rotation-app`** — Operational Movements Tauri app + dashboard.
  Repo: `dad2lna-coder/Rotation_App`, branch `Side-Quest`.
  Checkout: `../../rotation_app` (kept at workspace root; notes here).
- **`facttt`** — OneDrive share tooling for the FACTTT side-quest share.
  Location: `OneDrive - USTSA\FACTTT` (no local repo yet).

## Adding one

1. `mkdir -p projects/<slug>/punchlists`
2. Write `projects/<slug>/README.md` — one line of purpose + repo URL/status.
3. Add it to the Active list above.

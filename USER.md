```md
# USER.md - User Model

## Directives

<!-- observed: 2026-09-19 | status: active -->

- Prefer cheap/single-pass chat for small punchlists and one-file edits; reserve heavy/build-agent mode for greenfield scaffolds, multi-file architecture, or blocked builds.

<!-- observed: 2026-09-19 | status: active -->

- Prefer self-contained copy-paste punchlists with behavior inline — never “see chat,” “see prior commit,” or “look elsewhere.”

<!-- observed: 2026-09-19 | status: active -->

- Prefer tightly scoped one-step punchlists; Never over-scope into a giant multi-file rewrite.

<!-- observed: 2026-09-19 | status: active -->

- Prefer paste-ready prompts in the message body; Never attach punchlists unless asked.

<!-- observed: 2026-09-19 | status: active -->

- Prefer concise no-fluff outputs when pasting elsewhere; skip diagnosis unless asked.

<!-- observed: 2026-09-19 | status: active -->

- Prefer one clarifying product question at a time; wait for the answer before the next.

<!-- observed: 2026-09-19 | status: active -->

- Prefer a fresh punchlist-only chat for token-sensitive executor work; Never continue long threads when that will do.

<!-- observed: 2026-09-19 | status: active -->

- Prefer a single clear attempt; Never retry the same failing push/auth/build more than once without asking; Prefer stop-and-report on PLACEHOLDER/stub or parse errors — Never unattended fix→retry→fix loops.

<!-- observed: 2026-09-19 | status: active -->

- Never rewrite monoliths from memory (large `index.html`, fat configs, etc.); Prefer surgical edits or restore-known-good then a tiny re-patch.

<!-- observed: 2026-09-19 | status: active -->

- Never invent PLACEHOLDER / USE_FILE / stub replacements for real source files.

<!-- observed: 2026-09-19 | status: active -->

- Prefer HTML products as `index.html` (shell), `css/`, `js/` (tauri-bridge / state / UI / boot) — one extract per punchlist; Never keep a growing monolithic index.html long-term.

<!-- observed: 2026-09-19 | status: active -->

- Prefer edit SOURCE only when a module has a CI dist build; let CI rebuild dist — Never local npm-build+push fat dist or token-burning push/auth retries.

<!-- observed: 2026-09-19 | status: active -->

- Prefer hard-fail size/sha gates after risky file ops (no undersized “prepared” frontend); prepare scripts copy only, never regenerate HTML.

<!-- observed: 2026-09-19 | status: active -->

- Prefer side-quest / greenfield work here (new apps, FACTTT, Rotation, standalone tools); Prefer bake features outside hot code first when useful.

<!-- observed: 2026-09-19 | status: active -->

- Always lead with the result; Prefer plain language; Never pad with “Certainly,” restating the ask, or filler closings.

<!-- observed: 2026-09-19 | status: active -->

- Prefer one compiled ship file per module for offline/shared-drive apps when that ship rule applies.

<!-- observed: 2026-09-19 | status: active -->

- Prefer portable OneDrive exe for FACTTT-style apps with Refresh/Save via Rust; Never require daily manual Import/Export JSON once the exe exists.

<!-- observed: 2026-09-19 | status: active -->

- Prefer `dashboard.json` (never “master”) at `OneDrive - USTSA\FACTTT\data\`; auto-create if missing; submits to `inbox\`.

<!-- observed: 2026-09-19 | status: active -->

- Prefer existing OSS/plugins/free platforms before custom builds; recommend paid only with spend approval.

<!-- observed: 2026-09-19 | status: active -->

- Prefer stating the model in use and announcing changes; on complex tasks say it will take a while and if still working.

<!-- observed: 2026-09-19 | status: active -->

- Always treat the user as James Moore (America/Chicago); when acting through his accounts speak as him — Never third person.

<!-- observed: 2026-09-19 | status: active -->

- Prefer keeping project notes under `projects/<slug>/` (README.md, optional NOTES.md, punchlists/).
```
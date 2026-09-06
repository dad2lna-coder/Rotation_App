# Rotation Builder

Offline checkpoint rotation sheet builder. Open `index.html` locally after extracting scripts, or use the GitHub Pages test site.

## Test site (GitHub Pages)

- Split app: https://dad2lna-coder.github.io/Rotation_App/
- Original monolith fallback: https://dad2lna-coder.github.io/Rotation_App/original_file/RotationBuilder%201.html

First Pages deploy uses GitHub Actions (`.github/workflows/pages.yml`). If the link 404s, open the repo **Settings → Pages**, set Source to **GitHub Actions**, and re-run the **Deploy GitHub Pages** workflow.

## Run locally

```bash
python3 tools/extract_js.py .
# then open index.html in a browser
```

No build step. Scripts stay classic (non-module) and load in the original order so shared globals keep working.

## Structure

```text
index.html
css/styles.css
js/vendor/xlsx.js          # extracted from the original file
js/core/01-foundation.js
js/core/02-roster.js
js/core/03-projections.js
js/engine/04-engine.js
js/ui/05-render.js
js/ui/06-theme.js
js/ui/07-editing.js
js/ui/08-config-ui.js
docs/
original_file/RotationBuilder 1.html
tools/extract_js.py
```

## Refactor strategy

Low-risk structural split, not a behavioral rewrite. Section boundaries from the original source are preserved.

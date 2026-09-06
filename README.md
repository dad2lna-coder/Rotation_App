# Rotation Builder

Offline checkpoint rotation sheet builder.

## Live app

https://dad2lna-coder.github.io/Rotation_App/original_file/RotationBuilder%201.html

Self-contained file. Roster and projections stay in the browser; nothing is sent to a server. A baked demo roster for CKPT-A12 / 2026-09-06 loads when local storage is empty.

## Run locally

Open `original_file/RotationBuilder 1.html` in a browser.

Optional split for development:

```bash
python3 tools/extract_js.py .
python3 tools/bake_demo.py
```

Then open `index.html`.

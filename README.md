# Rotation Builder

Offline checkpoint rotation sheet builder.

## Live test (working now)

GitHub Pages cannot be turned on by an app token. Use the original monolith via jsDelivr until Pages is enabled on the repo:

**https://cdn.jsdelivr.net/gh/dad2lna-coder/Rotation_App@main/original_file/RotationBuilder%201.html**

That file is self-contained (HTML + CSS + JS + SheetJS). Upload roster/projections in the browser; nothing is sent to a server.

After you set **Settings → Pages → Source: GitHub Actions** and re-run the workflow, the split app will be at:

- https://dad2lna-coder.github.io/Rotation_App/
- Fallback: https://dad2lna-coder.github.io/Rotation_App/original_file/RotationBuilder%201.html

## Run locally

```bash
python3 tools/extract_js.py .
# open index.html
```

Or just open `original_file/RotationBuilder 1.html`.

# Rotation Builder - Organized Source Package

This package is a structural decomposition of the supplied `RotationBuilder 1.html.txt`.

## Run

Open `index.html` in a browser. No build step is required.

## Structure

```text
RotationBuilder_organized/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── vendor/
│   │   └── xlsx.js
│   ├── core/
│   │   ├── 01-foundation.js
│   │   ├── 02-roster.js
│   │   └── 03-projections.js
│   ├── engine/
│   │   └── 04-engine.js
│   └── ui/
│       ├── 05-render.js
│       ├── 06-theme.js
│       ├── 07-editing.js
│       └── 08-config-ui.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EVALUATION.md
│   └── MANIFEST.json
└── original/
    └── RotationBuilder 1.html.txt
```

## Refactor strategy

This is a **low-risk structural split**, not a behavioral rewrite. The source's own section boundaries are preserved and the scripts are loaded in the same order as the original application.

The JavaScript remains classic scripts rather than ES modules so the existing shared global state continues to work.

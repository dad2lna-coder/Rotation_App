#!/usr/bin/env python3
"""Split RotationBuilder monolith scripts into the documented js/ layout."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ORIG_CANDIDATES = [
    ROOT / "original_file" / "RotationBuilder 1.html",
    ROOT / "original" / "RotationBuilder 1.html.txt",
]


def find_original():
    for p in ORIG_CANDIDATES:
        if p.exists():
            return p
    raise SystemExit("Original monolith not found")


def main():
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    text = find_original().read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    def sl(a, b):
        return "\n".join(lines[a - 1 : b]) + "\n"

    files = {
        "js/vendor/xlsx.js": sl(983, 1103),
        "js/core/01-foundation.js": sl(1108, 1314),
        "js/core/02-roster.js": sl(1315, 1468),
        "js/core/03-projections.js": sl(1469, 1703),
        "js/engine/04-engine.js": sl(1704, 2172),
        "js/ui/05-render.js": sl(2173, 2196),
        "js/ui/06-theme.js": sl(2197, 2573),
        "js/ui/07-editing.js": sl(2574, 2992),
        "js/ui/08-config-ui.js": sl(2993, len(lines) - 1),
    }

    for rel, content in files.items():
        path = dest / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"wrote {rel} ({len(content)} bytes)")


if __name__ == "__main__":
    main()

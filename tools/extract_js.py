#!/usr/bin/env python3
"""Split RotationBuilder monolith scripts into the BLADE-style js/ layout."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ORIG = ROOT / "original_file" / "RotationBuilder 1.html"

HEADER = """/* Rotation Builder — classic script, BLADE-style load order.
   Shared globals are intentional (same contract as the gold HTML).
*/
\"use strict\";
"""

def sl(lines, a, b):
    out = []
    for L in lines[a - 1 : b]:
        s = L.strip()
        if s.startswith("<script") or s == "</script>":
            continue
        out.append(L)
    return HEADER + "\n".join(out).rstrip() + "\n"


def main():
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    lines = ORIG.read_text(encoding="utf-8", errors="replace").splitlines()
    files = {
        "js/vendor/xlsx.js": sl(lines, 984, 1106).replace(HEADER, ""),
        "js/core/01-foundation.js": sl(lines, 1108, 1317),
        "js/core/02-roster.js": sl(lines, 1318, 1471),
        "js/core/03-projections.js": sl(lines, 1472, 1706),
        "js/engine/04-engine.js": sl(lines, 1707, 2175),
        "js/ui/05-state-render.js": sl(lines, 2176, 2995),
        "js/ui/06-config-boot.js": sl(lines, 2996, 3841),
    }
    for rel, content in files.items():
        path = dest / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"wrote {rel} ({len(content)} bytes)")


if __name__ == "__main__":
    main()

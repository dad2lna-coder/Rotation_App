#!/usr/bin/env python3
"""Split RotationBuilder scripts by <script> tags, not stale line numbers."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ORIG = ROOT / "original_file" / "RotationBuilder 1.html"


def main():
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    text = ORIG.read_text(encoding="utf-8", errors="replace")
    scripts = re.findall(r"<script\b[^>]*>(.*?)</script>", text, flags=re.S | re.I)
    if not scripts:
        raise SystemExit("no script tags in original html")

    vendor = dest / "js" / "vendor"
    vendor.mkdir(parents=True, exist_ok=True)
    app_parts = []
    xlsx = None
    for body in scripts:
        s = body.strip()
        if not s:
            continue
        if "xlsx.js" in s[:400] or "DO_NOT_EXPORT_CODEPAGE" in s[:200]:
            xlsx = s
        else:
            app_parts.append(s)

    if xlsx:
        (vendor / "xlsx.js").write_text(xlsx + "\n", encoding="utf-8")
        print("wrote js/vendor/xlsx.js", len(xlsx))
    app = "\n\n".join(app_parts) + "\n"
    out = dest / "js" / "rotation-app.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(app, encoding="utf-8")
    print("wrote js/rotation-app.js", len(app))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate FACTTT-style app icons and scripts/icons-b64.json."""
from __future__ import annotations

import base64
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "icons"
B64 = ROOT / "scripts" / "icons-b64.json"

NAVY = (15, 23, 42, 255)
BLUE = (29, 78, 216, 255)
TEAL = (15, 118, 110, 255)
WHITE = (248, 250, 252, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(1, size // 16)
    d.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=max(4, size // 6),
        fill=NAVY,
    )
    bar_h = max(2, size // 14)
    d.rounded_rectangle(
        [pad, size - pad - bar_h - 1, size - pad - 1, size - pad - 1],
        radius=bar_h // 2,
        fill=TEAL,
    )
    # Inner disc
    m = size // 5
    d.ellipse([m, m - size // 18, size - m, size - m - size // 18], fill=BLUE)
    font = None
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        p = Path(candidate)
        if p.exists():
            font = ImageFont.truetype(str(p), size=int(size * 0.34))
            break
    text = "OM"
    if font is None:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.04),
        text,
        font=font,
        fill=WHITE,
    )
    return img


def png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def ico_bytes(images: list[Image.Image]) -> bytes:
    buf = BytesIO()
    images[0].save(
        buf,
        format="ICO",
        sizes=[(im.width, im.height) for im in images],
        append_images=images[1:],
    )
    return buf.getvalue()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }
    files: dict[str, bytes] = {}
    rendered: dict[int, Image.Image] = {}
    for name, size in sizes.items():
        img = draw_icon(size)
        rendered[size] = img
        data = png_bytes(img)
        (OUT / name).write_bytes(data)
        files[name] = data

    ico_images = [rendered[32], rendered[128], rendered[256]]
    ico = ico_bytes(ico_images)
    (OUT / "icon.ico").write_bytes(ico)
    files["icon.ico"] = ico

    encoded = {name: base64.b64encode(data).decode("ascii") for name, data in files.items()}
    B64.write_text(json.dumps(encoded, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)
    print("wrote", B64, "chars", B64.stat().st_size)


if __name__ == "__main__":
    main()

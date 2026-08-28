#!/usr/bin/env python3
"""Regenerate the PWA icons from the square source worked.png.

Source:   frontend/public/icons/worked.png (must be square)
Outputs:  icon-192x192.png, icon-512x512.png, icon-maskable-512x512.png

The artwork is flattened onto a white background so iOS (apple-touch-icon)
never renders transparent areas as black. The maskable icon scales the artwork
to ~80% of the canvas to stay inside the safe zone.

Run:  python3 scripts/gen_icons.py
"""

from PIL import Image

SOURCE = "frontend/public/icons/worked.png"
ICON_DIR = "frontend/public/icons"
BACKGROUND = (255, 255, 255, 255)

MASKABLE_FRACTION = 0.8


def flatten(img: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    canvas.alpha_composite(img.resize((size, size), Image.Resampling.LANCZOS))
    return canvas.convert("RGB")


def maskable(img: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    inner = round(size * MASKABLE_FRACTION)
    resized = img.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - inner) // 2, (size - inner) // 2))
    return canvas.convert("RGB")


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    if src.width != src.height:
        raise SystemExit(f"source must be square, got {src.width}x{src.height}")
    flatten(src, 512).save(f"{ICON_DIR}/icon-512x512.png")
    flatten(src, 192).save(f"{ICON_DIR}/icon-192x192.png")
    maskable(src, 512).save(f"{ICON_DIR}/icon-maskable-512x512.png")
    print("icons regenerated from worked.png")


if __name__ == "__main__":
    main()
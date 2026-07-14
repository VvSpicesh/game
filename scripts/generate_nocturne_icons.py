"""Generate icon-192.png / icon-512.png from assets/icons/icon.svg design locally (stdlib + Pillow).

No network, no third-party icon packs. Re-run:
  python scripts/generate_nocturne_icons.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "icons"


def draw_icon(size: int) -> Image.Image:
  img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
  d = ImageDraw.Draw(img)
  s = size / 512

  def px(v: float) -> int:
    return int(round(v * s))

  # rounded background approximating SVG gradient
  d.rounded_rectangle([0, 0, size - 1, size - 1], radius=px(96), fill=(7, 23, 16, 255))
  # subtle upper wash
  overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
  od = ImageDraw.Draw(overlay)
  od.ellipse([px(-80), px(-120), px(320), px(280)], fill=(11, 37, 27, 180))
  img = Image.alpha_composite(img, overlay)
  d = ImageDraw.Draw(img)

  # frame
  d.rounded_rectangle(
    [px(72), px(72), px(440), px(440)],
    radius=px(48),
    outline=(255, 255, 255, 30),
    width=max(2, px(8)),
  )

  # chessboard hint
  board = (143, 183, 255, 56)
  for x, y in ((112, 300), (200, 300), (156, 344), (244, 344)):
    d.rectangle([px(x), px(y), px(x + 44), px(y + 44)], fill=board)

  # moon disc + cutout crescent
  moon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
  md = ImageDraw.Draw(moon)
  md.ellipse([px(208), px(108), px(392), px(292)], fill=(246, 231, 178, 255))
  md.ellipse([px(260), px(100), px(416), px(256)], fill=(11, 37, 27, 255))
  img = Image.alpha_composite(img, moon)
  d = ImageDraw.Draw(img)

  # knight glyph
  glyph = "♞"
  font = None
  for name, fsize in (
    ("seguiemj.ttf", px(92)),
    ("Segoe UI Symbol.ttf", px(92)),
    ("arial.ttf", px(84)),
  ):
    try:
      font = ImageFont.truetype(name, fsize)
      break
    except OSError:
      continue
  if font is None:
    font = ImageFont.load_default()
  d.text((px(156), px(170)), glyph, fill=(220, 229, 251, 255), font=font, anchor="mm")

  return img


def main() -> None:
  OUT.mkdir(parents=True, exist_ok=True)
  svg = OUT / "icon.svg"
  if not svg.exists():
    raise SystemExit(f"missing {svg}; keep SVG as source of design")
  for size in (192, 512):
    out = OUT / f"icon-{size}.png"
    draw_icon(size).save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


if __name__ == "__main__":
  main()

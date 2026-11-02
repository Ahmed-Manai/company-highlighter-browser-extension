"""Generate the extension icons (icons/icon-*.png) with no third-party dependencies.

The icon is a blue rounded square showing three lines of "text", the middle one
highlighted in yellow. Shapes are drawn at 8x and averaged down for anti-aliasing.

Usage: python scripts/generate_icons.py
"""
import os
import struct
import zlib

SIZES = [16, 32, 48, 128]
SCALE = 8

BLUE = (31, 111, 235)
WHITE = (255, 255, 255)
YELLOW = (255, 235, 59)
DARK = (31, 35, 40)

# Shapes in a 0..1 coordinate space: (x0, y0, x1, y1, corner radius, colour), drawn in order
SHAPES = [
    (0.00, 0.00, 1.00, 1.00, 0.22, BLUE),
    (0.18, 0.22, 0.82, 0.32, 0.05, WHITE),
    (0.12, 0.42, 0.88, 0.58, 0.06, YELLOW),
    (0.20, 0.46, 0.70, 0.54, 0.04, DARK),
    (0.18, 0.68, 0.64, 0.78, 0.05, WHITE),
]


def inside_rounded_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size):
    big = size * SCALE
    pixels = []
    for py in range(size):
        row = []
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SCALE):
                for sx in range(SCALE):
                    x = (px * SCALE + sx + 0.5) / big
                    y = (py * SCALE + sy + 0.5) / big
                    colour = None
                    for x0, y0, x1, y1, r, c in SHAPES:
                        if inside_rounded_rect(x, y, x0, y0, x1, y1, r):
                            colour = c
                    if colour:
                        acc[0] += colour[0]
                        acc[1] += colour[1]
                        acc[2] += colour[2]
                        acc[3] += 255
            n = SCALE * SCALE
            alpha = acc[3] / n
            if alpha:
                # Un-premultiply so edge pixels keep their real colour
                coverage = acc[3] / 255
                row.append((round(acc[0] / coverage), round(acc[1] / coverage), round(acc[2] / coverage), round(alpha)))
            else:
                row.append((0, 0, 0, 0))
        pixels.append(row)
    return pixels


def write_png(path, pixels):
    height, width = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + b"".join(struct.pack("BBBB", *p) for p in row) for row in pixels)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        path = os.path.join(out_dir, f"icon-{size}.png")
        write_png(path, render(size))
        print("wrote", os.path.normpath(path))


if __name__ == "__main__":
    main()

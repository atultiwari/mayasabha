"""Prepare a character picture for the projector: transparent background, trimmed, sensible size.

Usage (run from mayasabha/):
    python3 -I scripts/prepare_character.py INPUT OUTPUT.png [--max-height 1000] [--remove-white]

- Pictures that already have transparency are trimmed to the character so its feet touch the bottom
  edge (characters then stand exactly on the ledges).
- --remove-white clears a plain white/light background that touches the picture's border (typical
  clip-art). White areas inside the outline (eyes, belly) are kept because they don't touch the border.
"""
import argparse
import sys
from collections import deque

from PIL import Image

ALPHA_FLOOR = 12  # pixels fainter than this count as empty when trimming
MIN_BLOB_SHARE = 0.01  # blobs smaller than 1% of the main character are treated as specks


def remove_border_white(img: Image.Image, tolerance: int) -> Image.Image:
    """Flood-fills from the border through near-white pixels and makes them transparent."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    seen = bytearray(w * h)

    def light(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and min(r, g, b) >= 255 - tolerance

    queue = deque((x, y) for x in range(w) for y in (0, h - 1))
    queue.extend((x, y) for y in range(h) for x in (0, w - 1))
    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if seen[i] or not light(x, y):
            continue
        seen[i] = 1
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                queue.append((nx, ny))
    return rgba


def remove_specks(img: Image.Image) -> Image.Image:
    """Erases small stray blobs (cut-out leftovers) that would otherwise widen the crop.

    Keeps every connected blob of at least MIN_BLOB_SHARE of the biggest one, so separate real parts
    (a raised hand, a tail tip) survive while dots and slivers go.
    """
    mask = img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    w, h = mask.size
    data = mask.load()
    label = [0] * (w * h)
    blobs = []
    for start in range(w * h):
        if label[start] or not data[start % w, start // w]:
            continue
        blob_id = len(blobs) + 1
        stack, pixels = [start], []
        label[start] = blob_id
        while stack:
            i = stack.pop()
            pixels.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not label[j] and data[nx, ny]:
                    label[j] = blob_id
                    stack.append(j)
        blobs.append(pixels)
    if not blobs:
        return img
    biggest = max(len(b) for b in blobs)
    out = img.copy()
    px = out.load()
    for pixels in blobs:
        if len(pixels) < biggest * MIN_BLOB_SHARE:
            for i in pixels:
                r, g, b, _ = px[i % w, i // w]
                px[i % w, i // w] = (r, g, b, 0)
    return out


def trim(img: Image.Image) -> Image.Image:
    alpha = img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    box = alpha.getbbox()
    if not box:
        raise ValueError("picture is completely transparent")
    return img.crop(box)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--max-height", type=int, default=1000)
    parser.add_argument("--remove-white", action="store_true")
    parser.add_argument("--tolerance", type=int, default=28, help="how far from pure white still counts as background")
    args = parser.parse_args()

    try:
        img = Image.open(args.input).convert("RGBA")
    except OSError as err:
        sys.exit(f"cannot open {args.input}: {err}")
    if args.remove_white:
        img = remove_border_white(img, args.tolerance)
    img = trim(remove_specks(img))
    if img.height > args.max_height:
        img = img.resize((round(img.width * args.max_height / img.height), args.max_height), Image.LANCZOS)
    img.save(args.output, optimize=True)
    print(f"{args.output}: {img.width}x{img.height}")


if __name__ == "__main__":
    main()

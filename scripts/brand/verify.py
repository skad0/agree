"""Check delivery geometry and XML without requiring the application server."""
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public"
NAVY = (11, 17, 32)

for path in OUT.glob("*.svg"):
    root = ET.parse(path).getroot()
    assert root.tag == "{http://www.w3.org/2000/svg}svg", path
    assert len(root.attrib["viewBox"].split()) == 4, path
    for element in root.iter():
        assert element.tag.rsplit("}", 1)[-1] not in {"script", "style", "text", "image", "foreignObject"}, path
        assert "style" not in element.attrib, path
        assert not any(key.endswith("href") for key in element.attrib), path

for name, expected in {
    "apple-touch-icon.png": (180, 180), "icon-192.png": (192, 192), "icon-512.png": (512, 512),
    "x-profile-avatar.png": (400, 400), "x-banner.png": (1500, 500), "og-image.png": (1200, 630),
}.items():
    img = Image.open(OUT / name).convert("RGBA")
    assert img.size == expected, name
    assert img.getchannel("A").getextrema() == (255, 255), name

for name, radius in [("x-profile-avatar.png", 170), ("icon-192.png", 76.8), ("icon-512.png", 204.8)]:
    img = Image.open(OUT / name).convert("RGB")
    center = img.width / 2
    for y in range(img.height):
        for x in range(img.width):
            if img.getpixel((x, y)) != NAVY:
                assert (x + .5 - center) ** 2 + (y + .5 - center) ** 2 <= radius ** 2, (name, x, y)

overlap = Image.open(OUT / "x-banner.png").convert("RGB").crop((0, 300, 300, 500))
assert ImageChops.difference(overlap, Image.new("RGB", overlap.size, NAVY)).getbbox() is None
ico = Image.open(OUT / "favicon.ico")
assert ico.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
assert (OUT / "og-image.png").read_bytes() == (ROOT / "src/assets/share-he.png").read_bytes()
print("PASS: SVG XML, dimensions, opacity, avatar and maskable safe circles, X overlap area, ICO sizes, Hebrew OG parity.")

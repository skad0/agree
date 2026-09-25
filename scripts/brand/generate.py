"""Regenerate the identity kit; optional authoring tools, never a server dependency."""
from pathlib import Path
from io import BytesIO
from html import escape
import json
from zipfile import ZipFile, ZIP_DEFLATED

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb
import resvg_py
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public"
SOURCE = ROOT / "docs/brand/source"
NAVY, WHITE, GREEN, MUTED = "#0B1120", "#F8FAFC", "#10B981", "#A7B6CA"


def font(path, weight=400):
    ft = TTFont(path)
    if "fvar" in ft:
        ft = instantiateVariableFont(ft, {"wght": weight}, inplace=False)
    ft.flavor = None
    buffer = BytesIO()
    ft.save(buffer)
    hf = hb.Font(hb.Face(buffer.getvalue()))
    return ft, hf


HE = font(SOURCE / "NotoSansHebrew.ttf")
HE_BOLD = font(SOURCE / "NotoSansHebrew.ttf", 750)
LATIN = font(SOURCE / "NotoSans.ttf")
LATIN_BOLD = font(SOURCE / "NotoSans.ttf", 700)
ARABIC = font(SOURCE / "NotoSansArabic.ttf")
ETHIOPIC = font(ROOT / "src/assets/NotoSansEthiopic-400.woff2")


def text_path(text, x, baseline, size, face=HE, fill=WHITE, align="right", max_width=None):
    """HarfBuzz supplies real RTL shaping; bake positioned glyphs into one path."""
    ft, hf = face
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hf, buf)
    scale = size / ft["head"].unitsPerEm
    width = sum(p.x_advance for p in buf.glyph_positions) * scale
    if max_width and width > max_width:
        scale *= max_width / width
        width = max_width
    cursor = x - width if align == "right" else x
    glyphs = ft.getGlyphSet()
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyphs[ft.getGlyphName(info.codepoint)].draw(TransformPen(pen, (
            scale, 0, 0, -scale, cursor + pos.x_offset * scale, baseline - pos.y_offset * scale)))
        cursor += pos.x_advance * scale
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>'


def mark(x=0, y=0, size=32, ink=WHITE, accent=GREEN):
    return (f'<g transform="translate({x} {y}) scale({size / 32:g})">'
            f'<path fill="{ink}" d="M8 8h16v12h-4v-8H8z"/>'
            f'<path fill="{accent}" d="M6 24h20v4H6z"/></g>')


def svg(width, height, body, title, background=NAVY):
    bg = f'<path fill="{background}" d="M0 0h{width}v{height}H0z"/>' if background else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title">'
            f'<title id="title">{escape(title)}</title>{bg}{body}</svg>\n')


def save(name, content, png=True):
    (OUT / f"{name}.svg").write_text(content, encoding="utf-8")
    if png:
        (OUT / f"{name}.png").write_bytes(resvg_py.svg_to_bytes(svg_string=content, skip_system_fonts=True))


def ledger(x, y, width, height):
    # Decorative register only: no invented scores, election data, or party rankings.
    lines = "".join(f'M{x + i} {y}v{height}' for i in range(0, width + 1, 48))
    lines += "".join(f'M{x} {y + i}h{width}' for i in range(0, height + 1, 48))
    return (f'<path d="{lines}" fill="none" stroke="#1C2A3D" stroke-width="1"/>'
            f'<path d="M{x} {y + 96}h{width}" stroke="{GREEN}" stroke-width="3"/>'
            f'<path fill="{GREEN}" d="M{x + 93} {y + 93}h6v6h-6zM{x + 237} {y + 93}h6v6h-6z"/>')


OUT.mkdir(exist_ok=True)
favicon = svg(32, 32, mark(), "רף משותף — Common Bar")
save("favicon", favicon, png=False)
save("icon", svg(512, 512, mark(64, 48, 384), "רף משותף — Common Bar"), png=False)
save("logo-mark", svg(32, 32, mark(ink=NAVY), "רף משותף — Common Bar", background=None), png=False)
save("logo-mark-light", svg(32, 32, mark(), "רף משותף — Common Bar", background=None), png=False)
save("logo-monochrome", svg(32, 32, mark(ink=NAVY, accent=NAVY), "רף משותף — Common Bar", background=None), png=False)
save("x-profile-avatar", svg(400, 400, mark(50, 38, 300), "רף משותף — Common Bar"))
for size, name in [(180, "apple-touch-icon"), (192, "icon-192"), (512, "icon-512")]:
    (OUT / f"{name}.png").write_bytes(resvg_py.svg_to_bytes(
        svg_path=str(OUT / "icon.svg"), width=size, height=size, skip_system_fonts=True))
ico_frames = [Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=favicon, width=s, height=s))) for s in [16, 32, 48]]
ico_frames[-1].save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico_frames[:-1])

# Typography is outlined in every delivery SVG; title retains accessible logical Hebrew.
lockup = text_path("רף משותף", 480, 86, 82, HE_BOLD, NAVY) + mark(512, 0, 112, NAVY)
save("logo", svg(640, 128, lockup, "רף משותף", background=None), png=False)
save("logo-light", svg(640, 128, lockup.replace(NAVY, WHITE), "רף משותף", background=None), png=False)

banner = ledger(72, 94, 432, 144)
banner += text_path("COMMON BAR", 72, 60, 18, LATIN_BOLD, MUTED, "left")
banner += mark(1312, 131, 112)
banner += text_path("רף משותף", 1260, 226, 108, HE_BOLD, max_width=650)
banner += text_path("מדד המחויבות האזרחית", 1260, 294, 38, max_width=720)
banner += '<path d="M640 352h724" stroke="#26354A"/>'
banner += text_path("rafmeshutaf.org.il", 1364, 402, 22, LATIN, MUTED)
save("x-banner", svg(1500, 500, banner, "רף משותף | מדד המחויבות האזרחית"))


def share_card(locale):
    body = mark(60, 46, 112) + ledger(72, 264, 288, 144)
    body += text_path("רף משותף", 1104, 207, 108, HE_BOLD, max_width=850)
    if locale == "he":
        body += text_path("מדד המחויבות האזרחית", 1104, 300, 44)
        body += text_path("לקראת הבחירות", 1104, 355, 36, HE, MUTED)
        body += text_path("מי מהמפלגות עומדת בקווי היסוד?", 1104, 466, 38, max_width=930)
        title = "רף משותף | מדד המחויבות האזרחית לקראת הבחירות — מי מהמפלגות עומדת בקווי היסוד?"
    else:
        copy = json.loads((ROOT / f"src/locales/{locale}.json").read_text(encoding="utf-8"))
        face = ARABIC if locale == "ar" else ETHIOPIC if locale == "am" else HE if locale == "yi" else LATIN
        body += text_path("COMMON BAR", 1104, 286, 30, LATIN_BOLD, GREEN)
        body += text_path(copy["slogan"], 1104, 466, 38, face, max_width=950)
        title = f'Common Bar — {copy["slogan"]}'
    body += '<path d="M72 531h1032" stroke="#26354A"/>'
    body += text_path("rafmeshutaf.org.il", 1104, 578, 22, LATIN, MUTED)
    return svg(1200, 630, body, title)


save("og-image", share_card("he"))
for locale in ["he", "en", "ar", "yi", "ru", "uk", "am"]:
    (ROOT / f"src/assets/share-{locale}.png").write_bytes(
        resvg_py.svg_to_bytes(svg_string=share_card(locale), skip_system_fonts=True))

manifest = {
    "id": "/", "name": "רף משותף | Common Bar", "short_name": "רף משותף",
    "description": "מדד המחויבות האזרחית לקראת הבחירות", "lang": "he", "dir": "rtl",
    "start_url": "/he", "scope": "/", "display": "standalone",
    "background_color": NAVY, "theme_color": NAVY,
    "icons": [{"src": f"/icon-{s}.png", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any maskable"} for s in [192, 512]]
}
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# A review sheet with real exports, circular crop, and actual small favicon sizes.
sheet = Image.new("RGB", (1600, 1420), "#E9EEF3")
draw = ImageDraw.Draw(sheet)
label_font = ImageFont.truetype(str(SOURCE / "NotoSans.ttf"), 20)
heading_font = ImageFont.truetype(str(SOURCE / "NotoSans.ttf"), 34)
draw.text((48, 30), "COMMON BAR / IDENTITY", fill=NAVY, font=heading_font)
draw.text((48, 83), "Threshold + Hebrew resh. Navy / white / verification emerald.", fill="#4D5A72", font=label_font)
avatar = Image.open(OUT / "x-profile-avatar.png").convert("RGB").resize((264, 264))
mask = Image.new("L", (264, 264)); ImageDraw.Draw(mask).ellipse((0, 0, 263, 263), fill=255)
sheet.paste(avatar, (48, 143), mask)
draw.text((352, 150), "CIRCULAR AVATAR", fill=NAVY, font=label_font)
for i, size in enumerate([16, 32, 48]):
    icon = Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=favicon, width=size, height=size)))
    sheet.paste(icon, (352 + i * 110, 212))
    draw.text((352 + i * 110, 280), f"{size}px", fill=NAVY, font=label_font)
for i, color in enumerate([NAVY, WHITE, GREEN]):
    x = 825 + i * 240
    draw.rectangle((x, 157, x + 200, 277), fill=color)
    draw.text((x, 291), color, fill=NAVY, font=label_font)
sheet.paste(Image.open(OUT / "x-banner.png").convert("RGB"), (50, 453))
draw.text((50, 419), "X HEADER / 1500 x 500", fill=NAVY, font=label_font)
og = Image.open(OUT / "og-image.png").convert("RGB"); og.thumbnail((760, 400))
sheet.paste(og, (50, 994))
draw.text((854, 1002), "SOCIAL SHARE / 1200 x 630", fill=NAVY, font=label_font)
draw.text((854, 1050), "Outlined Hebrew. No font dependencies.", fill="#4D5A72", font=label_font)
draw.text((854, 1090), "Maskable icons. Solid Apple touch icon.", fill="#4D5A72", font=label_font)
draw.text((854, 1130), "X avatar overlap zone kept empty.", fill="#4D5A72", font=label_font)
sheet.save(ROOT / "docs/brand/identity-preview.png")
with ZipFile(ROOT / "docs/brand/common-bar-identity.zip", "w", ZIP_DEFLATED) as kit:
    for path in sorted(OUT.iterdir()):
        kit.write(path, path.name)
    kit.write(ROOT / "docs/brand/identity-preview.png", "identity-preview.png")
    for path in sorted(SOURCE.glob("*.txt")):
        kit.write(path, f"licenses/{path.name}")
    kit.writestr("START-HERE.txt", "Common Bar / רף משותף\n\n"
        "Upload x-profile-avatar.png (400 x 400) and x-banner.png (1500 x 500) to X.\n"
        "Use og-image.png (1200 x 630) for Hebrew social link previews.\n"
        "SVG files are vector masters with outlined lettering and no font dependencies.\n"
        "Use favicon.svg or favicon.ico for browser tabs, apple-touch-icon.png for Apple,\n"
        "and icon-192.png / icon-512.png with manifest.json for app icons.\n"
        "logo.svg is dark artwork for light backgrounds; logo-light.svg is for dark backgrounds.\n"
        "Do not mirror the Hebrew mark. Keep four grid units of clear space.\n"
        "Palette: #0B1120 navy, #F8FAFC light slate, #10B981 emerald.\n"
        "Use #047857 for readable small text on white.\n")
print("Generated identity assets, seven sharing cards, manifest, and preview.")

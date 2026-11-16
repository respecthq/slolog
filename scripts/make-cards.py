"""X などのリンクカード用の正方形画像を作る（2026-11-16〜）。
・筐体画像のある機種：public/images/card/<slug>.jpg（600×600・白地の中央に筐体を縮小して置くだけ。切り抜き・加工はしない。下の余白に権利表記＝スミ一色）
・筐体画像のない機種：public/images/card/app-icon.png（スロログのアプリアイコン 512×512）
元の筐体画像は縦長・透過・1MB 超で、X のカードに出ないことがあった（ワンダーヴィーナスでグレーのまま）。
実行：python3 scripts/make-cards.py（筐体画像を足したら回す。[slug].astro は card/<slug>.jpg があればそれを使う）
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
OUT = PUB / 'images' / 'card'
OUT.mkdir(parents=True, exist_ok=True)
ICON = Path('/Users/calkee/Desktop/Projects/Kinana/app/slolog/assets/icon/icon_full@1x.png')
S, PAD = 600, 28
FONT = '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc'
INK = (34, 30, 28)   # 権利表記はスミ一色（白フチなし）

if ICON.exists():
    Image.open(ICON).convert('RGB').resize((512, 512), Image.LANCZOS).save(OUT / 'app-icon.png', optimize=True)
made = []
for md in sorted((ROOT / 'src' / 'content' / 'machines').glob('*.md')):
    head = md.read_text().split('\n---', 1)[0]
    m = re.search(r'^image:\s*\n\s+src:\s*(\S+)', head, re.M)
    if not m:
        continue
    block = re.search(r'^image:\s*\n((?:[ \t]+.*\n?)+)', head, re.M).group(1)
    cm = re.search(r'^\s+credit:\s*(.+)$', block, re.M)
    credit = cm.group(1).strip().strip("'\"") if cm else ''
    src = PUB / m.group(1).strip("'\"")
    im = Image.open(src).convert('RGBA')
    # 権利表記（筐体の下の余白に入れる。長いものは全角スペースで折り返す）
    lines, size = [], 15
    if credit:
        f = ImageFont.truetype(FONT, size)
        for part in credit.split('\u3000'):
            if lines and f.getlength(lines[-1] + '\u3000' + part) <= S - 40:
                lines[-1] += '\u3000' + part
            else:
                lines.append(part)
        while any(f.getlength(l) > S - 40 for l in lines) and size > 10:
            size -= 1; f = ImageFont.truetype(FONT, size)
    band = (len(lines) * (size + 6) + 14) if lines else 0
    k = min((S - PAD * 2) / im.width, (S - PAD * 2 - band) / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    card = Image.new('RGBA', (S, S), (255, 255, 255, 255))
    card.alpha_composite(im, ((S - im.width) // 2, PAD + (S - PAD * 2 - band - im.height) // 2))
    if lines:
        d = ImageDraw.Draw(card)
        y = S - PAD - band + 10
        for l in lines:
            d.text((S / 2, y), l, font=f, fill=INK + (255,), anchor='mt'); y += size + 6
    out = OUT / f'{md.stem}.jpg'
    card.convert('RGB').save(out, quality=88, optimize=True, progressive=True)
    made.append((md.stem, out.stat().st_size // 1024))
for slug, kb in made:
    print(f'{slug}: {kb}KB')
print(f'カード {len(made)} 枚＋アプリアイコン')

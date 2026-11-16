"""X などのリンクカード用の正方形画像を作る（2026-11-16〜）。
・筐体画像のある機種：public/images/card/<slug>.jpg（600×600・白地の中央に筐体を縮小して置くだけ。切り抜き・加工はしない）
・筐体画像のない機種：public/images/card/app-icon.png（スロログのアプリアイコン 512×512）
元の筐体画像は縦長・透過・1MB 超で、X のカードに出ないことがあった（ワンダーヴィーナスでグレーのまま）。
実行：python3 scripts/make-cards.py（筐体画像を足したら回す。[slug].astro は card/<slug>.jpg があればそれを使う）
"""
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
OUT = PUB / 'images' / 'card'
OUT.mkdir(parents=True, exist_ok=True)
ICON = Path('/Users/calkee/Desktop/Projects/Kinana/app/slolog/assets/icon/icon_full@1x.png')
S, PAD = 600, 28

if ICON.exists():
    Image.open(ICON).convert('RGB').resize((512, 512), Image.LANCZOS).save(OUT / 'app-icon.png', optimize=True)
made = []
for md in sorted((ROOT / 'src' / 'content' / 'machines').glob('*.md')):
    head = md.read_text().split('\n---', 1)[0]
    m = re.search(r'^image:\s*\n\s+src:\s*(\S+)', head, re.M)
    if not m:
        continue
    src = PUB / m.group(1).strip("'\"")
    im = Image.open(src).convert('RGBA')
    k = min((S - PAD * 2) / im.width, (S - PAD * 2) / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    card = Image.new('RGBA', (S, S), (255, 255, 255, 255))
    card.alpha_composite(im, ((S - im.width) // 2, (S - im.height) // 2))
    out = OUT / f'{md.stem}.jpg'
    card.convert('RGB').save(out, quality=88, optimize=True, progressive=True)
    made.append((md.stem, out.stat().st_size // 1024))
for slug, kb in made:
    print(f'{slug}: {kb}KB')
print(f'カード {len(made)} 枚＋アプリアイコン')

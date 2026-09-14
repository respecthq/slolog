#!/usr/bin/env python3
"""アプリの撮影 raw（1320x2868）を LP 用 webp（900x1955）にする。
Dynamic Island を描き足すのはここ。撮り直したらこれを回す。
  python3 scripts/make-screens.py record=12_record_filled expectation=04_machine_ev
"""
import sys, pathlib
from PIL import Image, ImageDraw

RAW = pathlib.Path.home()/'slolog/screenshots/raw'
OUT = pathlib.Path(__file__).resolve().parent.parent/'public/images/screens'
W, H = 900, 1955
ISLAND = (319, 22, 581, 98)   # 既存の webp から実測した位置
RADIUS = 38

def build(name, raw):
    src = RAW/f'{raw}.png'
    im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
    ImageDraw.Draw(im).rounded_rectangle(ISLAND, radius=RADIUS, fill=(0, 0, 0))
    dst = OUT/f'{name}.webp'
    im.save(dst, 'WEBP', quality=82, method=6)
    print(f'{dst.name}  <-  {src.name}  {dst.stat().st_size//1024}KB')

if __name__ == '__main__':
    args = sys.argv[1:] or ['record=12_record_filled']
    for a in args:
        build(*a.split('=', 1))

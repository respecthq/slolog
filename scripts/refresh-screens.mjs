// LPに載せるアプリ画面を、スロログの撮影ハーネス出力（screenshots/raw）から作り直す。
// 撮り直したら `node scripts/refresh-screens.mjs` を実行する。
// 出力先は public/editorial/assets/（Editorialレイアウトが参照している場所）。
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(path.join(process.env.CODEX_NODE_MODULES ||
  '/Users/calkee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
const sharp = req('sharp');

const RAW = '/Users/calkee/slolog/screenshots/raw';
const OUT = new URL('../public/editorial/assets/', import.meta.url).pathname;

// LP上の名前 → ハーネスの撮影名
const SCREENS = {
  home: '01_home',
  ev: '04_machine_ev',
  graph: '08_dashboard_line_tooltip',
  record: '12_record_filled',
  calendar: '13_calendar',
  review: '05_machine_kensho',
};

await fs.mkdir(OUT, { recursive: true });
for (const [name, source] of Object.entries(SCREENS)) {
  await sharp(path.join(RAW, `${source}.png`)).resize({ width: 900 }).webp({ quality: 90 })
    .toFile(path.join(OUT, `${name}.webp`));
  console.log(`✓ ${name}.webp  ← ${source}.png`);
}
// 「マイボーダー検証」だけを切り出した帯（トップの黒いセクションで使う）
await sharp(path.join(OUT, 'review.webp')).extract({ left: 28, top: 1038, width: 844, height: 400 })
  .webp({ quality: 95 }).toFile(path.join(OUT, 'review-detail.webp'));
console.log('✓ review-detail.webp  ← review.webp を切り出し');

// 北電子の公式製品ページから「確率表」（設定別のBB/RB/合成確率・出玉率）を取り込む。
//   node scripts/fetch-kitadenshi.mjs
// メーカーが自社サイトで公表している数値だけを、出典URL付きで機種mdへ書き戻す。
// 攻略メディアの値は使わない（SOURCES.md の方針）。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/machines';
const MARK_BEGIN = '<!-- spec:begin -->';
const MARK_END = '<!-- spec:end -->';

const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

function extract(html) {
  const block = html.match(/<div class="slot-spec">[\s\S]*?<table class="c-table">([\s\S]*?)<\/table>/);
  if (!block) return null;
  const head = [...block[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
  const rows = [...block[1].matchAll(/<tr[^>]*>\s*<th>(\d)<\/th>([\s\S]*?)<\/tr>/g)]
    .map((m) => [m[1], ...[...m[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1]))]);
  if (!rows.length) return null;
  // 先頭の「設定」を除いた列見出し（BB確率 / RB確率 / 合成確率 / 出玉率）
  const cols = head.slice(1, rows[0].length);
  const idx = (name) => cols.findIndex((c) => c.includes(name));
  const range = (name) => {
    const i = idx(name);
    if (i < 0) return '';
    const a = rows[0][i + 1], b = rows[rows.length - 1][i + 1];
    return a === b ? a : `${a}〜${b}`;
  };
  return { cols, rows, bonus: range('合成'), payout: range('出玉率') };
}

function table(spec) {
  const head = `| 設定 | ${spec.cols.join(' | ')} |`;
  const sep = `|---:|${spec.cols.map(() => '---:').join('|')}|`;
  const body = spec.rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

function setField(fm, key, value) {
  const re = new RegExp(`^${key}:.*$`, 'm');
  const line = `${key}: '${value}'`;
  return re.test(fm) ? fm.replace(re, line) : `${fm.trimEnd()}\n${line}\n`;
}

let done = 0, skipped = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const [, fm, ...rest] = text.split('---');
  const body = rest.join('---');
  const source = (fm.match(/^source:\s*(.*)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!source.includes('kitadenshi.co.jp')) continue;

  let html;
  try {
    const res = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0 (slolog spec-fetch)' }, signal: AbortSignal.timeout(20000) });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.log(`✗ ${file}  ${e.message}`); skipped++; continue;
  }
  const spec = extract(html);
  if (!spec) { console.log(`△ ${file}  確率表なし（掲載前かページ構成が違う）`); skipped++; continue; }

  let newFm = setField(fm, 'bonus', spec.bonus);
  newFm = setField(newFm, 'payout', spec.payout);

  const section = `${MARK_BEGIN}\n\n## 設定別スペック\n\n${table(spec)}\n\n${MARK_END}`;
  const newBody = body.includes(MARK_BEGIN)
    ? body.replace(new RegExp(`${MARK_BEGIN}[\\s\\S]*?${MARK_END}`), section)
    : `${body.trimEnd()}\n\n${section}\n`;

  writeFileSync(path, `---${newFm}---${newBody}`);
  console.log(`✓ ${file}  合成 ${spec.bonus} ／ 出玉率 ${spec.payout}`);
  done++;
}
console.log(`\n取り込み ${done} 件 / 見送り ${skipped} 件`);

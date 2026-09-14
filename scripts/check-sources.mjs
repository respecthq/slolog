// 配信中（draft でない）機種の出典URLが生きているかを確認する。
// 週次ルーティンやローカルで `node scripts/check-sources.mjs` を実行。
// 非200があれば一覧を出して終了コード1（CIやルーティンで気づけるように）。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/machines';
const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
const targets = [];
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  const fm = text.split('---')[1] ?? '';
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1] ?? '').trim();
  const draft = /^draft:\s*true/m.test(fm);
  // 架空機（自社のオリジナル機）は出典が存在しないので対象外。配信JSONにも入らない
  const fictional = /^fictional:\s*true/m.test(fm);
  const source = get('source').replace(/^['"]|['"]$/g, '');
  if (draft || fictional) continue;
  targets.push({ file: f, name: get('name'), source });
}

let bad = 0;
for (const t of targets) {
  if (!t.source) { console.log(`✗ ${t.file}  出典なし（配信中なのに）`); bad++; continue; }
  try {
    const res = await fetch(t.source, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Mozilla/5.0 (slolog source-check)' } });
    if (res.status !== 200) { console.log(`✗ ${t.file}  HTTP ${res.status}  ${t.source}`); bad++; }
    else console.log(`✓ ${t.file}`);
  } catch (e) {
    console.log(`✗ ${t.file}  ${e.name}  ${t.source}`); bad++;
  }
}
console.log(`\n配信中 ${targets.length} 件 / 問題 ${bad} 件`);
process.exit(bad ? 1 : 0);

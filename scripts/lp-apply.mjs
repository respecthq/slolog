// 進行表の「OK 待ち」を反映する。  node scripts/lp-apply.mjs A1 A3   （all で全部）
//   new    … 用意済みの md の draft を外して公開
//   update … frontmatter の値を書き換え、updated / updateNote を付ける。body: [[旧, 新]] があれば本文も置き換える
// 反映したら notes/lp-proposals.json に appliedAt を記録する。このあと npm run build → crosscheck → push。
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'notes/lp-proposals.json';
const props = JSON.parse(readFileSync(P, 'utf8'));
const want = process.argv.slice(2); const _n = new Date(); const ymd = new Date(_n - _n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const q = (v) => (/^[\w./-]+$/.test(String(v)) && !/^\d/.test(String(v)) ? v : `'${String(v).replace(/'/g, "''")}'`);
for (const p of props) {
  if (p.appliedAt || !(want.includes('all') || want.includes(p.id))) continue;
  const file = `src/content/machines/${p.slug}.md`;
  let [, fm, ...rest] = readFileSync(file, 'utf8').split('---'); let body = rest.join('---');
  const set = (k, v) => { const line = `${k}: ${q(v)}`; fm = new RegExp(`^${k}:.*$`, 'm').test(fm) ? fm.replace(new RegExp(`^${k}:.*$`, 'm'), line) : fm.replace(/\n$/, `\n${line}\n`); };
  if (p.kind === 'new') fm = fm.replace(/^draft:\s*true.*$/m, 'draft: false');
  for (const [k, v] of Object.entries(p.changes ?? {})) {
    if (k === 'verified') {
      fm = fm.replace(/^verified:\n(?:\s+.*\n)+/m, '');
      fm = fm.replace(/\n$/, `\nverified:\n  by: [${v.by.map((x) => `'${x}'`).join(', ')}]\n  url: ${v.url}\n  date: ${v.date}\n  crosscheck: ${v.crosscheck}\n`);
    } else set(k, v);
  }
  for (const [from, to] of p.body ?? []) { if (!body.includes(from)) { console.error(`✗ ${p.id}：本文に「${from}」が見つかりません`); process.exit(1); } body = body.replace(from, to); }
  if (p.kind === 'update') { set('updated', ymd); if (p.updateNote) set('updateNote', p.updateNote); }
  writeFileSync(file, `---${fm}---${body}`);
  p.appliedAt = ymd; console.log(`✓ ${p.id} ${p.name} を反映（${file}）`);
}
writeFileSync(P, JSON.stringify(props, null, 1));

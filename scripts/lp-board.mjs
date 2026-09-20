// LP の進行表（notes/LP_BOARD.md・非公開）を作る。週次の検証の最後に回す。
//   node scripts/lp-board.mjs
// 流れ： ①候補（まだページなし） → ②LP 作成済み・更新待ち → ③完了。いちばん上に「OK 待ち」（出典を見て OK を出せば反映できるもの）。
//   候補       … notes/lp-queue.json（検定通過／メーカー公開／導入済み・未掲載）
//   OK 待ち    … notes/lp-proposals.json（新規ページ＝draft の md を用意済み／更新＝入れる値と出典）。反映は scripts/lp-apply.mjs
//   更新待ち・完了 … src/content/machines/*.md から自動判定
// 完了の条件： 型式名あり ＋ 天井が決着（あり or 仕様上なし）＋ 公表値が決着（掲載済み or 導入から 60 日たっても公表なし）＋ 導入済み
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/machines';
const SITE = 'https://respecthq.github.io/slolog/machines/';
const today = new Date(); const ymd = new Date(today - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10); // 日本時間の日付
const load = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const queue = load('notes/lp-queue.json', []);
const proposals = load('notes/lp-proposals.json', []);
const snap = load('notes/source-snapshots.json', {});

const machines = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && !x.startsWith('_'))) {
  const fm = readFileSync(join(dir, f), 'utf8').split('---')[1] ?? '';
  const one = (k) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1] ?? '').split(' #')[0].trim().replace(/^['"]|['"]$/g, '');
  const flag = (k) => new RegExp(`^${k}:\\s*true`, 'm').test(fm);
  if (flag('fictional')) continue;
  const slug = f.replace(/\.md$/, ''); const rel = one('released');
  const relDate = rel ? new Date(rel.length === 7 ? rel + '-01' : rel) : null;   // 月までなら、その月に入ったら導入済みとみなす
  const released = relDate ? relDate <= today : false;
  const daysSince = relDate ? Math.floor((today - relDate) / 86400000) : null;
  const hasSpec = !!(one('bonus') || one('payout') || one('junzo'));
  const specSettled = hasSpec || flag('specNone') || (released && daysSince > 60);
  const ceilSettled = !!one('ceiling') || flag('noCeiling');
  const wait = [];
  if (flag('draft')) wait.push('下書き（出典が未確認）');
  if (!released) wait.push(`導入前（${rel || '時期未定'}）`);
  if (!one('modelName')) wait.push('型式名がまだ');
  if (!specSettled) wait.push('公表値がまだ（メーカーの公表待ち）');
  if (!ceilSettled) {
    const c = snap['ceiling:' + slug]; const st = (x) => (x?.url ? (x.has ? '天井あり' : '天井まだ') : 'ページ未登録');
    wait.push(`天井がまだ（パチガブ：${st(c?.gabu)}／必勝本：${st(c?.hissho)}）`);
  }
  machines.push({ slug, name: one('name'), maker: one('maker'), rel, source: one('source'), draft: flag('draft'), wait,
    note: !hasSpec && specSettled && !flag('specNone') ? '公表値はメーカー未公表（導入から 60 日超）' : '' });
}
const byRel = (a, b) => (b.rel || '').localeCompare(a.rel || '');
const waiting = machines.filter((m) => m.wait.length).sort(byRel);
const done = machines.filter((m) => !m.wait.length).sort(byRel);
const pending = proposals.filter((p) => !p.appliedAt);

let md = `# LP 進行表（${ymd}）\n\n`;
md += `OK 待ち **${pending.length}**／候補 **${queue.length}**／更新待ち **${waiting.length}**／完了 **${done.length}**\n\n`;
md += `使い方：「OK 待ち」の出典を開いて確かめ、**「A1 と A3 OK」** のように Claude に伝える → その場で反映して公開します。\n\n---\n\n`;

md += `## 🟠 OK 待ち（出典を見て OK を出せば、すぐ反映できるもの）\n\n`;
if (!pending.length) md += `いまはありません。\n\n`;
for (const p of pending) {
  md += `- [ ] **${p.id}**｜${p.kind === 'new' ? '🆕 新しいページ' : '✏️ 更新'}｜**${p.name}**\n`;
  md += `  - 内容：${p.summary}\n`;
  for (const [k, v] of Object.entries(p.changes ?? {})) md += `  - \`${k}\` → ${typeof v === 'object' ? JSON.stringify(v) : v}\n`;
  md += `  - 出典：${p.source}\n`;
  if (p.crosscheck) md += `  - 照合：${p.crosscheck}\n`;
  if (p.note) md += `  - メモ：${p.note}\n`;
}
md += `\n## 🔵 候補（まだ LP にページがない）\n\n`;
if (!queue.length) md += `いまはありません。\n\n`;
const order = { 'メーカー公開': 0, '導入済み・未掲載': 1, '検定通過': 2 };
for (const q of [...queue].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9))) {
  md += `- **${q.name}**（${q.maker || 'メーカー不明'}）｜${q.stage}${q.release ? '｜導入 ' + q.release : ''}\n`;
  md += `  - 次にやること：${q.next}\n`;
  if (q.officialUrl) md += `  - 公式：${q.officialUrl}\n`;
  if (q.note) md += `  - メモ：${q.note}\n`;
}
md += `\n## 🟡 LP 作成済み・更新待ち（情報がまだ増える）\n\n`;
for (const m of waiting) {
  md += `- **${m.name}**（${m.maker}）｜導入 ${m.rel || '未定'}${m.draft ? '｜下書き（非公開）' : ''}\n`;
  for (const w of m.wait) md += `  - ⏳ ${w}\n`;
  md += `  - ページ：${m.draft ? '（下書きのため非公開）' : SITE + m.slug + '/'}${m.source ? '｜出典：' + m.source : '｜出典：なし'}\n`;
}
md += `\n## 🟢 完了（情報が出そろった。以後は見張りだけ）\n\n`;
for (const m of done) md += `- ${m.name}（${m.maker}）｜${m.rel}${m.note ? '｜' + m.note : ''}\n`;
md += `\n---\n\n判定の決まり：完了＝型式名あり＋天井が決着（あり／仕様上なし）＋公表値が決着（掲載済み／導入から 60 日たっても未公表）＋導入済み。\n完了した機種も \`watch-sources.mjs\` が見張り続け、公式ページに変化があれば「OK 待ち」に戻します。\n`;
writeFileSync('notes/LP_BOARD.md', md);
console.log(`notes/LP_BOARD.md を更新：OK 待ち ${pending.length}／候補 ${queue.length}／更新待ち ${waiting.length}／完了 ${done.length}`);

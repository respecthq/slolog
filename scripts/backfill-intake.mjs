// 過去の週次レポート（区分の列が無い 7〜9 月分）を取り込み、LP と候補リストに照らして仕分ける。
//   node scripts/backfill-intake.mjs <レポート.md> [--date YYYY-MM-DD]
// ・全文を notes/weekly/backfill/<date>.md に保存
// ・JSON（無ければ表）から機種を拾い、LP に載っている＝既報／候補にある＝候補の続報／どちらも無い＝NEW に仕分ける
// ・NEW は notes/lp-queue.json に積む（foundAt＝レポートの日付・backfill: true）。単一スニペット（unconfirmed）は積まずに一覧だけ出す
// ・notes/weekly/index.json に backfill: true の行として入れる（進行表の「週次レポート」に未検証として並ぶ）
// 検証は全部そろってから機種ごとに 1 回（同じ機種が何週も出てくるため）。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { norm } from './lib-names.mjs';
// パチンコ機（型式名・機種名の頭が e／P／PA／CR）は扱わない
const isPachinko = (n) => /^(e|P|PA|CR)[^a-zA-Z]/.test(String(n ?? '').normalize('NFKC').trim()) || /パチンコ機/.test(String(n ?? ''));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !/^\d{4}-\d{2}-\d{2}$/.test(a));
const di = args.indexOf('--date');
const text = readFileSync(file, 'utf8');
const date = (di >= 0 && args[di + 1]) || text.match(/新台\s*(?:日報|週報)\s*(\d{4}-\d{2}-\d{2})/)?.[1] || text.match(/"date":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
if (!date) { console.error('日付が読めません。--date YYYY-MM-DD を付けてください'); process.exit(1); }
const today = new Date().toISOString().slice(0, 10);

// LP の機種（名前と型式名の両方で照合）
const dir = 'src/content/machines'; const lp = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const fm = readFileSync(`${dir}/${f}`, 'utf8').split('---')[1] ?? '';
  const one = (k) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1] ?? '').replace(/^['"]|['"]$/g, '').trim();
  for (const n of [one('name'), one('modelName')]) if (n) lp.set(norm(n), f.replace(/\.md$/, ''));
}
const QP = 'notes/lp-queue.json'; const queue = existsSync(QP) ? JSON.parse(readFileSync(QP, 'utf8')) : [];
const inQueue = (k) => queue.find((q) => norm(q.name) === k);
// 型式名の末尾記号（ZB・TM など）を外した名前でも照合する
const keys = (name) => { const k = norm(name); return [k, k.replace(/[a-z0-9]{1,3}$/i, '')].filter(Boolean); };
const find = (name) => { for (const k of keys(name)) { if (lp.has(k)) return ['known', lp.get(k)]; const q = inQueue(k); if (q) return ['update', q.name]; } return ['new', null]; };

let rows = [];
const json = text.match(/```json\s*([\s\S]*?)```/)?.[1];
try { const d = JSON.parse(json);
  for (const m of d.machines ?? []) rows.push({ name: m.name, maker: m.maker, release: m.release_date, conf: m.confidence, url: m.source_url, cert: false });
  for (const m of d.certified ?? []) rows.push({ name: m.name, maker: m.maker, release: null, conf: m.confidence, url: m.source_url, cert: true, found: m.found_date });
} catch { console.error('JSON が読めませんでした。表からは拾っていません'); }

const seen = new Set(); const items = []; const added = []; const skipped = [];
for (const r of rows) {
  const k = norm(r.name); if (!r.name || seen.has(k) || isPachinko(r.name)) continue; seen.add(k);
  const [kind, ref] = find(r.name);
  items.push({ kind, name: r.name, note: kind === 'known' ? `LP 掲載済み（${ref}）` : kind === 'update' ? `候補にあり（${ref}）` : r.cert ? '検定通過' : '', section: r.cert ? '検定通過' : '導入予定・新台', conf: r.conf });
  if (kind !== 'new') continue;
  if (r.conf === 'unconfirmed') { skipped.push(r.name); continue; }
  const stage = r.cert ? '検定通過' : r.release && r.release <= today ? '導入済み・未掲載' : 'メーカー公開';
  queue.push({ name: r.name, maker: r.maker || '', stage, release: r.release ? `${r.release}（${date} のレポートの値・未確認）` : '', next: 'メーカー公式の出典を探す（過去分の検証）', officialUrl: '', note: `${date} の過去レポートから。レポートの出典：${r.url || 'なし'}`, foundAt: date, backfill: true });
  added.push(`${r.name}（${stage}）`);
}
writeFileSync(`notes/weekly/backfill/${date}.md`, text);
writeFileSync(QP, JSON.stringify(queue, null, 1));
const IP = 'notes/weekly/index.json'; const index = JSON.parse(readFileSync(IP, 'utf8'));
let e = index.find((w) => w.date === date); if (!e) { e = { date }; index.push(e); }
const counts = { new: items.filter((i) => i.kind === 'new').length, update: items.filter((i) => i.kind === 'update').length, known: items.filter((i) => i.kind === 'known').length };
Object.assign(e, { draft: `backfill/${date}.md`, verified: e.verified ?? null, verifiedAt: e.verifiedAt ?? null, backfill: true, items, counts, summary: `過去分の取り込み：未掲載 ${counts.new}／候補にあり ${counts.update}／LP 掲載済み ${counts.known}` });
index.sort((a, b) => a.date.localeCompare(b.date)); writeFileSync(IP, JSON.stringify(index, null, 1));
console.log(`${date}：機種 ${items.length} 件（未掲載 ${counts.new}／候補にあり ${counts.update}／LP 掲載済み ${counts.known}）`);
for (const i of items) console.log(`  ${i.kind === 'new' ? '🆕' : i.kind === 'update' ? '➕' : '＝'} ${i.name}｜${i.note || i.section}${i.conf === 'unconfirmed' ? '｜単一スニペット' : ''}`);
if (added.length) console.log(`候補リストに追加：${added.join('、')}`);
if (skipped.length) console.log(`単一スニペットなので積まなかった：${skipped.join('、')}`);

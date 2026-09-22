// 週次レポート（クラウドの週次ルーティンの出力）を取り込み、区分（🆕 NEW／➕ 追加情報／＝ 既報）を進行表の元データにする。
//   node scripts/weekly-import.mjs <レポート.md> [--date YYYY-MM-DD] [--session URL]
// ・レポートの全文を notes/weekly/<date>_draft.md に保存（同じファイルを渡したら上書きしない）
// ・表の「区分」列と JSON の kubun を読み、notes/weekly/index.json の items に入れる
// ・クラウドは前の週を見られないので、NEW でも notes/lp-queue.json にある機種は「追加情報（候補の続報）」に直す
// 区分の正はこのレポート。進行表（lp-board.mjs）は items を読んで NEW／追加情報の印を付ける。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { norm } from './lib-names.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !/^\d{4}-\d{2}-\d{2}$/.test(a) && !/^https?:/.test(a));
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
if (!file || !existsSync(file)) { console.error('使い方: node scripts/weekly-import.mjs <レポート.md> [--date YYYY-MM-DD] [--session URL]'); process.exit(1); }
const text = readFileSync(file, 'utf8');
const date = opt('date') || text.match(/パチスロ新台(?:日報|週報)\s*(\d{4}-\d{2}-\d{2})/)?.[1];
if (!date) { console.error('レポートの日付が読めません。--date YYYY-MM-DD を付けてください'); process.exit(1); }


const kindOf = (cell) => (/🆕|NEW/i.test(cell) ? 'new' : /➕|追加情報/.test(cell) ? 'update' : /＝|既報/.test(cell) ? 'known' : null);
const items = new Map();
let section = ''; let head = null;
for (const raw of text.split('\n')) {
  const line = raw.trim();
  if (/^#{2,3}\s/.test(line)) section = line.replace(/^#+\s*/, '').replace(/^[^\p{L}\p{N}]+/u, '');
  if (!line.startsWith('|')) { head = null; continue; }
  if (/^\|\s*-/.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells[0] === '区分') { head = cells; continue; }
  if (!head || !head.includes('機種名')) continue;
  const kind = kindOf(cells[0]); const name = cells[head.indexOf('機種名')];
  if (!kind || !name || name === '—') continue;
  const note = (cells[0].split(/[：:]/).slice(1).join('：') || '').trim();
  const key = norm(name);
  if (!items.has(key) || (!items.get(key).note && note)) items.set(key, { kind, name: name.replace(/\*\*/g, ''), note, section });
}
// 表が読めなかったときは JSON の kubun を使う
if (!items.size) {
  const json = text.match(/```json\s*([\s\S]*?)```/)?.[1];
  try { const d = JSON.parse(json); for (const m of [...(d.machines ?? []), ...(d.certified ?? [])]) if (m.kubun && m.name) items.set(norm(m.name), { kind: m.kubun, name: m.name, note: m.update_note || '', section: m.found_date !== undefined ? '検定通過' : '導入予定・新台' }); } catch {}
}
// ローカル補正：候補にもう積んである機種は「候補の続報」
const queue = existsSync('notes/lp-queue.json') ? JSON.parse(readFileSync('notes/lp-queue.json', 'utf8')) : [];
const queued = new Set(queue.map((q) => norm(q.name)));
let fixed = 0;
for (const [k, it] of items) if (it.kind === 'new' && queued.has(k)) { it.kind = 'update'; it.note = it.note || '候補の続報'; it.fixedLocally = true; fixed++; }

const draftName = `${date}_draft.md`; const draftPath = `notes/weekly/${draftName}`;
if (resolve(file) !== resolve(draftPath)) writeFileSync(draftPath, text);
const P = 'notes/weekly/index.json';
const index = existsSync(P) ? JSON.parse(readFileSync(P, 'utf8')) : [];
let e = index.find((w) => w.date === date);
if (!e) { e = { date, draft: null, verified: null, verifiedAt: null, summary: '' }; index.push(e); }
const list = [...items.values()];
const counts = { new: list.filter((i) => i.kind === 'new').length, update: list.filter((i) => i.kind === 'update').length, known: list.filter((i) => i.kind === 'known').length };
Object.assign(e, { draft: draftName, items: list, counts, importedAt: new Date().toISOString().slice(0, 10) });
if (opt('session')) e.sessionUrl = opt('session');
if (!e.summary) e.summary = `NEW ${counts.new}／追加情報 ${counts.update}／既報 ${counts.known}`;
index.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(P, JSON.stringify(index, null, 1));
console.log(`${date} を取り込み：NEW ${counts.new}／追加情報 ${counts.update}／既報 ${counts.known}${fixed ? `（うち ${fixed} 件は候補にあるので NEW → 追加情報に補正）` : ''}`);

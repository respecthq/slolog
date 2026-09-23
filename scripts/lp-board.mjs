// LP の進行表（notes/LP_BOARD.md・非公開）を作る。週次の検証の最後に回す。
//   node scripts/lp-board.mjs
// 流れ： ①候補（まだページなし） → ②LP 作成済み・更新待ち → ③完了。いちばん上に「OK 待ち」（出典を見て OK を出せば反映できるもの）。
//   候補       … notes/lp-queue.json（検定通過／メーカー公開／導入済み・未掲載）
//   OK 待ち    … notes/lp-proposals.json（新規ページ＝draft の md を用意済み／更新＝入れる値と出典）。反映は scripts/lp-apply.mjs
//   更新待ち・完了 … src/content/machines/*.md から自動判定
// 完了の条件（2026-09-23〜 天井・ゾーンは扱わない）： 型式名あり ＋ 公表値が決着（掲載済み or 導入から 60 日たっても公表なし）＋ 導入済み
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { norm } from './lib-names.mjs';

const dir = 'src/content/machines';
const SITE = 'https://respecthq.github.io/slolog/machines/';
const today = new Date(); const ymd = new Date(today - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10); // 日本時間の日付
const load = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const queue = load('notes/lp-queue.json', []);
const proposals = load('notes/lp-proposals.json', []);
const snap = load('notes/source-snapshots.json', {});

// ---- NEW と 追加情報 の見分け ----
//   NEW      … この FRESH_DAYS 日で初めて載ったもの（機種ページ＝frontmatter の added／候補＝foundAt）
//   追加情報 … 前からあるものに情報が増えたもの（機種ページ＝updated＋updateNote／候補＝updatedAt＋updateNote）
//   updated の書き忘れに備えて、FRESH_DAYS 日前の版（git）と中身の項目を比べ、変わっていれば追加情報とみなす
const FRESH_DAYS = 7;
const cutoff = new Date(new Date(ymd) - FRESH_DAYS * 86400000).toISOString().slice(0, 10);
const inWin = (d) => !!d && String(d).slice(0, 10) >= cutoff;
const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const baseRev = git('rev-list', '-1', `--before=${cutoff}T00:00:00+09:00`, 'HEAD');
const INFO = {   // 天井・ゾーンは 2026-09-23 から扱わないので、変化を数えない
  released: '導入日', modelName: '型式名', kenteiNo: '型式名', bonus: '公表値', payout: '公表値', junzo: '公表値', koyaku: '公表値',
  type: '機種の種類', gen: '機種の種類', cabinet: '機種の種類', source: '出典', image: '画像', name: '機種名', maker: 'メーカー', draft: '公開・非公開' };
const blocks = (fm) => { const o = {}; let k = null; for (const line of fm.split('\n')) { const m = line.match(/^([A-Za-z]+):/); if (m) { k = m[1]; o[k] = line; } else if (k) o[k] += '\n' + line; } return o; };
const lastChange = (path) => (git('status', '--porcelain', '--', path) ? ymd : git('log', '-1', '--format=%cs', '--', path) || ymd);
const queueFresh = (q) => (inWin(q.foundAt) ? { kind: 'new', date: q.foundAt, note: '候補入り' }
  : inWin(q.updatedAt) ? { kind: 'upd', date: q.updatedAt, note: q.updateNote || '情報が増えた' } : null);

const manualWatch = new Set(existsSync('notes/watch-manual.json') ? JSON.parse(readFileSync('notes/watch-manual.json', 'utf8')) : []);
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
  const wait = [];
  if (flag('draft')) wait.push('下書き');
  if (!released) wait.push(`導入前（${rel || '時期未定'}）`);
  if (!one('modelName')) wait.push('型式名待ち');
  if (!specSettled) wait.push(manualWatch.has(slug) ? '公表値待ち（手で確認）' : '公表値待ち');   // 手で確認＝公式ページが PDF だけ／ボット対策で自動では見張れない（watch-sources.mjs が書く）
  // 天井の確認先（777パチガブ・必勝本）。verified / crosscheckUrl / watch のどこに書いてあっても拾う
  const refUrls = [...new Set([...fm.matchAll(/https:\/\/[^\s'"]*(?:p-gabu\.jp|hisshobon\.jp)[^\s'"]*/g)].map((x) => x[0]))];
  const refs = { gabu: refUrls.find((u) => u.includes('p-gabu.jp')), hissho: refUrls.find((u) => u.includes('hisshobon.jp')) };
  let fresh = null;
  const backfill = relDate && one('added') && relDate < new Date(new Date(one('added')) - 30 * 86400000);   // 導入から 30 日以上たってから載せた
  if (inWin(one('added'))) fresh = { kind: 'new', date: one('added'), note: (flag('draft') ? '下書き作成' : '新規ページ') + (backfill ? '（後追い掲載）' : '') };
  else if (inWin(one('updated'))) fresh = { kind: 'upd', date: one('updated'), note: one('updateNote') || '更新' };
  else if (baseRev) {
    const path = join(dir, f); const old = git('show', `${baseRev}:${path}`);
    if (!old) fresh = { kind: 'new', date: lastChange(path), note: '新規ページ' };
    else {
      const a = blocks(old.split('---')[1] ?? ''), b = blocks(fm);
      const changed = [...new Set(Object.keys(INFO).filter((k) => (a[k] ?? '').trimEnd() !== (b[k] ?? '').trimEnd()).map((k) => INFO[k]))];
      if (changed.length) fresh = { kind: 'upd', date: lastChange(path), note: `${changed.join('・')}が変わった（更新メモなし）` };
    }
  }
  const factRefs = { pworld: one('modelNameSource'), news: one('newsSource'), cross: one('crosscheckUrl') };
  machines.push({ slug, fresh, factRefs, name: one('name'), maker: one('maker'), rel, source: one('source'), draft: flag('draft'), wait, refs, ceiling: one('ceiling'), noCeiling: flag('noCeiling'),
    note: !hasSpec && specSettled && !flag('specNone') ? '公表値なし（導入60日超）' : '' });
}
const byRel = (a, b) => (b.rel || '').localeCompare(a.rel || '');
const pending = proposals.filter((p) => !p.appliedAt);
const pendingSlugs = new Set(pending.filter((p) => p.kind === 'new').map((p) => p.slug));   // OK 待ちの下書きは更新待ちに重ねて出さない
const waiting = machines.filter((m) => m.wait.length && !pendingSlugs.has(m.slug)).sort(byRel);
const done = machines.filter((m) => !m.wait.length).sort(byRel);
// ---- 区分の正は週次レポート（scripts/weekly-import.mjs が index.json の items に入れたもの）----
//   いちばん新しいレポートの 🆕 NEW／➕ 追加情報 を印にする。レポートに無い機種だけ、LP 側の記録（added／updated・git）で補う
const reports = load('notes/weekly/index.json', []).filter((w) => w.items?.length && !w.backfill).sort((a, b) => b.date.localeCompare(a.date));
const latest = reports[0] ?? null;
const reportMap = new Map((latest?.items ?? []).map((i) => [norm(i.name), i]));
const fromReport = (name) => { const i = reportMap.get(norm(name)); return i && i.kind !== 'known' ? { kind: i.kind === 'new' ? 'new' : 'upd', date: latest.date, note: i.note || (i.kind === 'new' ? '初出' : '情報が増えた'), src: 'report' } : null; };
const inReport = (name) => reportMap.has(norm(name));   // レポートに載った機種は、既報も含めてレポートの判定だけを使う
for (const m of machines) m.fresh = inReport(m.name) ? fromReport(m.name) : (m.fresh ? { ...m.fresh, src: 'lp' } : null);
const qFresh = new Map(queue.map((q) => [q, inReport(q.name) ? fromReport(q.name) : (queueFresh(q) ? { ...queueFresh(q), src: 'lp' } : null)]));
const where = (name) => { const k = norm(name); const q = queue.find((x) => norm(x.name) === k); if (q) return ['候補', 'queue']; const m = machines.find((x) => norm(x.name) === k); if (m) return pendingSlugs.has(m.slug) ? ['OK 待ち', 'ok'] : m.wait.length ? ['更新待ち', 'wait'] : ['完了', 'done']; return ['LP 未登録', 'queue']; };
const recent = [
  ...(latest?.items ?? []).filter((i) => i.kind !== 'known').map((i) => { const [w, a] = where(i.name); return { f: fromReport(i.name), name: i.name, where: w, anchor: a }; }),
].filter((r) => r.f).sort((a, b) => (b.f.date || '').localeCompare(a.f.date || '') || (a.f.kind === 'new' ? -1 : 1));
const nNew = recent.filter((r) => r.f.kind === 'new').length, nUpd = recent.length - nNew;
const knownN = latest?.counts?.known ?? 0;
const mdMark = (f) => (f ? (f.kind === 'new' ? '🆕 NEW｜' : '➕ 追加情報｜') : '');
const weeklyAll = load('notes/weekly/index.json', []).sort((x, y) => y.date.localeCompare(x.date));
const back = weeklyAll.filter((w) => w.backfill);   // 過去分（7〜9 月の取り込み）は 1 行にまとめる
const weekly = weeklyAll.filter((w) => !w.backfill);   // 過去分（7〜9 月の取り込み）は検証済みなので出さない。記録は notes/weekly/backfill/   // 週次レポート：下書き（未検証の原文）と検証結果

let md = `# LP 進行表（${ymd}）\n\n`;
md += `OK 待ち **${pending.length}**／候補 **${queue.length}**／更新待ち **${waiting.length}**／完了 **${done.length}**\n\n`;
md += `この ${FRESH_DAYS} 日（${cutoff} 以降）：🆕 NEW **${nNew}**／➕ 追加情報 **${nUpd}**\n\n`;
md += `使い方：出典を確認 → **「A1 と A3 OK」** と Claude に送ると公開\n\n---\n\n`;

md += `## 🟠 OK 待ち\n\n`;
if (!pending.length) md += `いまはありません。\n\n`;
for (const p of pending) {
  md += `- [ ] **${p.id}**｜${p.kind === 'new' ? '🆕 NEW（新規ページ）' : '➕ 追加情報（前からある機種の更新）'}｜**${p.name}**\n`;
  md += `  - ${p.summary}\n`;
  for (const [k, v] of Object.entries(p.changes ?? {})) md += `  - \`${k}\` → ${typeof v === 'object' ? JSON.stringify(v) : v}\n`;
  md += `  - 出典：${p.source}\n`;
  if (p.crosscheck) md += `  - 照合：${p.crosscheck}\n`;
  if (p.note) md += `  - メモ：${p.note}\n`;
}
md += `\n## 📰 週次レポート\n\n`;
for (const w of weekly) md += `- ${w.date}｜${w.verified ? '検証済み（' + w.verifiedAt + '）' : '未検証'}｜${w.summary || ''}${w.verified ? '｜weekly/' + w.verified : ''}${w.sessionUrl ? '｜レポート ' + w.sessionUrl : w.draft ? '｜レポート weekly/' + w.draft : ''}\n`;
md += `\n## ✨ 今週の NEW と追加情報\n\n`;
md += latest ? `週次レポート ${latest.date} の区分（既報 ${knownN} 件は省略）\n\n` : `週次レポートの取り込みがまだありません\n\n`;
if (!recent.length) md += `ありません。\n\n`;
for (const r of recent) md += `- ${mdMark(r.f)}**${r.name}**｜いまの場所：${r.where}｜${r.f.note}｜${r.f.src === 'report' ? '週次レポート' : 'LP'} ${r.f.date}\n`;
md += `\n## 🔵 候補\n\n`;
if (!queue.length) md += `いまはありません。\n\n`;
const order = { 'メーカー公開': 0, '導入済み・未掲載': 1, '検定通過': 2 };
for (const q of [...queue].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9))) {
  md += `- ${mdMark(qFresh.get(q))}**${q.name}**（${q.maker || 'メーカー不明'}）｜${q.stage}${q.release ? '｜導入 ' + q.release : ''}\n`;
  md += `  - 次の作業：${q.next}\n`;
  if (q.officialUrl) md += `  - 公式：${q.officialUrl}\n`;
  if (q.note) md += `  - メモ：${q.note}\n`;
}
md += `\n## 🟡 更新待ち\n\n`;
for (const m of waiting) {
  md += `- ${mdMark(m.fresh)}**${m.name}**（${m.maker}）｜導入 ${m.rel || '未定'}${m.draft ? '｜下書き（非公開）' : ''}\n`;
  for (const w of m.wait) md += `  - ⏳ ${w}\n`;
  md += `  - ページ：${m.draft ? '（下書きのため非公開）' : SITE + m.slug + '/'}${m.source ? '｜出典：' + m.source : '｜出典：なし'}\n`;
}
md += `\n## 🟢 完了\n\n`;
for (const m of done) md += `- ${mdMark(m.fresh)}${m.name}（${m.maker}）｜${m.rel}${m.note ? '｜' + m.note : ''}\n`;
md += `\n---\n\n判定の決まり：完了＝型式名あり＋公表値が決着（掲載済み／導入から 60 日たっても未公表）＋導入済み。\n完了した機種も \`watch-sources.mjs\` が見張り続け、公式ページに変化があれば「OK 待ち」に戻します。\n`;
writeFileSync('notes/LP_BOARD.md', md);

// ---- 見る用の表（notes/LP_BOARD.html）。中身は md と同じデータ。ブラウザで開く ----
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (u, label) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '<span class="mute">—</span>');
const chip = (t) => { const k = /導入前/.test(t) ? 'pre' : /天井/.test(t) ? 'ceil' : /公表値/.test(t) ? 'spec' : /下書き|型式/.test(t) ? 'draft' : 'etc'; return `<span class="chip ${k}">${esc(t)}</span>`; };
const fchip = (f) => (f ? ` <span class="chip ${f.kind === 'new' ? 'new' : 'upd'}">${f.kind === 'new' ? 'NEW' : '追加情報'}</span>` : '');
const fnote = (f) => (f ? `<div class="sub">${f.kind === 'new' ? 'NEW' : '追加情報'} ${esc(f.date)}：${esc(f.note)}</div>` : '');
const newsLabel = (u) => (/yugitsushin/.test(u) ? '遊技通信' : /greenbelt/.test(u) ? 'グリーンべると' : /prtimes/.test(u) ? 'PR TIMES' : '業界紙');
const factLinks = (f) => [f?.pworld ? link(f.pworld, 'P-WORLD') : '', f?.news ? link(f.news, newsLabel(f.news)) : '', f?.cross ? link(f.cross, '照合') : ''].filter(Boolean).join(' · ');
const refLinks = (r) => [r?.gabu ? link(r.gabu, 'パチガブ') : '', r?.hissho ? link(r.hissho, '必勝本') : ''].filter(Boolean).join(' · ');
const ceilCell = (m) => `${m.ceiling ? esc(m.ceiling) : m.noCeiling ? '<span class="mute">なし（仕様）</span>' : '<span class="mute">まだ</span>'}${refLinks(m.refs) ? `<div class="sub">${refLinks(m.refs)}</div>` : ''}`;
const rowsPending = pending.map((p) => `<tr><td><button class="ok" data-copy="${esc(p.id)} OK">${esc(p.id)}</button></td><td><span class="chip ${p.kind === 'new' ? 'new' : 'upd'}">${p.kind === 'new' ? 'NEW' : '追加情報'}</span></td><td><b>${esc(p.name)}</b><div class="sub">${esc(p.summary)}</div>${Object.entries(p.changes ?? {}).map(([k, v]) => `<div class="kv"><code>${esc(k)}</code> → ${typeof v === 'string' && /^https?:\/\//.test(v) ? link(v, /yugitsushin|greenbelt|prtimes/.test(v) ? newsLabel(v) : new URL(v).hostname.replace(/^www\./, '')) : esc(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`).join('')}</td><td>${p.slug ? link('file://' + process.cwd() + '/src/content/machines/' + p.slug + '.md', p.kind === 'new' ? '下書き' : '現状') + '<br>' : ''}${link(p.source, '出典')}${p.crosscheck ? '<br>' + link(p.crosscheck, '照合') : ''}${(() => { const m = machines.find((x) => x.slug === p.slug); const f = m && factLinks(m.factRefs); return f ? '<br>' + f : ''; })()}</td></tr>`).join('');
const rowsQueue = [...queue].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9)).map((q) => `<tr><td><b>${esc(q.name)}</b>${fchip(qFresh.get(q))}<div class="sub">${esc(q.maker || 'メーカー不明')}</div></td><td><span class="chip etc">${esc(q.stage)}</span></td><td class="num">${esc(q.release || '—')}${fnote(qFresh.get(q))}</td><td>${esc(q.next)}${q.note ? `<div class="sub">${esc(q.note)}</div>` : ''}</td><td>${link(q.officialUrl, '公式')}</td></tr>`).join('');
const rowsWait = waiting.map((m) => `<tr><td><b>${esc(m.name)}</b>${fchip(m.fresh)}<div class="sub">${esc(m.maker)}</div>${fnote(m.fresh)}</td><td class="num">${esc(m.rel || '未定')}</td><td>${m.wait.map(chip).join(' ')}${factLinks(m.factRefs) ? `<div class="sub">確認元：${factLinks(m.factRefs)}</div>` : ''}</td><td>${m.draft ? '<span class="mute">非公開</span>' : link(SITE + m.slug + '/', 'LP')} · ${link(m.source, '出典')}</td></tr>`).join('');
const rowsDone = done.map((m) => `<tr><td>${esc(m.name)}${fchip(m.fresh)}<div class="sub">${esc(m.maker)}</div>${fnote(m.fresh)}</td><td class="num">${esc(m.rel)}</td><td class="sub">${esc(m.note || '')}${m.note && factLinks(m.factRefs) ? '<br>' : ''}${factLinks(m.factRefs)}</td><td>${link(SITE + m.slug + '/', 'LP')} · ${link(m.source, '出典')}</td></tr>`).join('');
const lpOf = (name) => { const k = norm(name); const m = machines.find((x) => norm(x.name) === k && !x.draft); return m ? SITE + m.slug + '/' : ''; };
const reportUrl = latest ? (latest.sessionUrl || (latest.draft ? 'file://' + process.cwd() + '/notes/weekly/' + latest.draft : '')) : '';
const rowsRecent = recent.map((r) => { const lp = lpOf(r.name); return `<tr><td>${fchip(r.f).trim()}</td><td>${lp ? `<a href="${esc(lp)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a>` : `<b>${esc(r.name)}</b>`}</td><td><a href="#${r.anchor}">${esc(r.where)}</a></td><td class="sub">${esc(r.f.note)}</td><td class="num">${r.f.src === 'report' && reportUrl ? `<a href="${esc(reportUrl)}" target="_blank" rel="noopener">週次レポート</a>` : r.f.src === 'report' ? '週次レポート' : 'LP'}<div class="sub">${esc(r.f.date)}</div></td></tr>`; }).join('');
const wfile = (f) => 'file://' + process.cwd() + '/notes/weekly/' + f;
const rowsWeekly = weekly.map((w) => `<tr data-week="${esc(w.date)}"><td class="num"><b>${esc(w.backfillGroup ? '過去分' : w.date)}</b>${w.backfillGroup ? `<div class="sub">${esc(w.date)}</div>` : ''}</td><td>${w.verified ? `<span class="chip okc">検証済み ${esc(w.verifiedAt)}</span>` : '<span class="chip ceil">未検証</span>'} <span class="chip unread" hidden>未読</span></td><td>${w.counts ? `<span class="chip new">NEW ${w.counts.new}</span><span class="chip upd">追加情報 ${w.counts.update}</span><span class="chip">既報 ${w.counts.known}</span><div class="sub">${esc(w.summary || '')}</div>` : esc(w.summary || '')}</td><td>${[w.verified ? `<a class="wk" href="${esc(wfile(w.verified))}" target="_blank">検証結果</a>` : '', w.sessionUrl ? `<a class="wk" href="${esc(w.sessionUrl)}" target="_blank" rel="noopener">レポート</a>` : w.draft ? `<a class="wk" href="${esc(wfile(w.draft))}" target="_blank">レポート</a>` : ''].filter(Boolean).join(' · ') || '<span class="mute">—</span>'}</td></tr>`).join('');
const section = (id, eyebrow, title, hint, head, rows, empty, fold = 0) => `<section id="${id}" class="block"><div class="block-head"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2><p class="hint">${hint}</p></div>${rows ? `${fold ? `<details class="fold"><summary>${fold} 件を表示</summary>` : ''}<div class="card scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${fold ? '</details>' : ''}` : `<div class="card empty">${empty}</div>`}</section>`;
// ちびキナナの吹き出し（いちばん先に見てほしいことを 1 つ）
const say = pending.length ? `OK 待ちが <b>${pending.length} 件</b>あるよ！<br>出典を見て OK してね`
  : recent.length ? `${latest ? '今週のレポートは' : `この ${FRESH_DAYS} 日で`}<br>NEW <b>${nNew}</b> 件・追加情報 <b>${nUpd}</b> 件！`
  : `今週は動きなし。<br>見張りは続けてるよ`;
const count = (href, tag, n, label, hot) => `<a class="count${hot ? ' hot' : ''}" href="${href}"><span class="count-tag">${tag}</span><b>${n}</b><span class="count-label">${label}</span></a>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LP 進行表</title><style>
:root{--paper:#fafbfc;--card:#fff;--ink:#111216;--muted:#62656c;--orange:#ef6b12;--link:#b84a00;--band:#ff8b32;--line:#dedfe3;--soft:#f3f4f6;--bubble:#fff;--shadow:0 16px 34px #1112161c;
--new:#ef6b12;--newI:#fff;--upd:#fff1e6;--updI:#a63c00;--updB:#f0c4a4;--pre:#e9effd;--preI:#2a4494;--ceil:#fff4cc;--ceilI:#6e4c00;--spec:#f0ebfd;--specI:#4a3596;--draft:#eef0f3;--draftI:#4b4e55;--ok:#1b7a47;--unread:#111216;--unreadI:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#0c0d10;--card:#181b21;--ink:#f5f5f7;--muted:#afb3be;--orange:#f5972a;--link:#ffab5c;--band:#c9661a;--line:#2b2f37;--soft:#1e2128;--bubble:#20242b;--shadow:0 16px 34px #0009;
--new:#f5972a;--newI:#1a0f03;--upd:#2e2012;--updI:#ffc98a;--updB:#6b4521;--pre:#1c2748;--preI:#a9bcff;--ceil:#33290f;--ceilI:#ffd66b;--spec:#271f45;--specI:#c9bcff;--draft:#23262e;--draftI:#c4c7cf;--ok:#52c787;--unread:#f5f5f7;--unreadI:#111216;color-scheme:dark}.brand{filter:invert(1) hue-rotate(180deg)}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:16px}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.75 -apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;font-synthesis:none}
h1,h2,p{margin:0}a{color:var(--link);text-underline-offset:3px}a:focus-visible,button:focus-visible{outline:3px solid var(--orange);outline-offset:3px;border-radius:4px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px}
.top{border-bottom:1px solid var(--line)}.top .wrap{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{width:128px;display:block}
.top-meta{display:flex;align-items:center;gap:12px;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}.private{font-size:11px;font-weight:750;border:1px solid var(--line);border-radius:4px;padding:3px 8px;color:var(--muted)}
.eyebrow{font-size:12px;font-weight:750;letter-spacing:.06em;line-height:1.5}.eyebrow b{color:var(--orange);margin-right:12px}
.hero-copy{padding-top:44px;padding-bottom:28px}.hero h1{font-size:46px;font-weight:900;line-height:1.3;margin-top:14px;letter-spacing:.01em}.hero h1 em{font-style:normal;color:var(--orange)}.lead{color:var(--muted);margin-top:10px;font-size:15px}
.stage{position:relative}.band{position:absolute;inset:58px 0 0;background:var(--band)}
.stage .wrap{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:24px;min-height:320px}
.counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-self:start}
.count{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px 14px;text-decoration:none;color:var(--ink);box-shadow:var(--shadow);transition:transform .18s,border-color .18s;display:flex;flex-direction:column}
.count:hover{transform:translateY(-3px);border-color:var(--orange)}.count-tag{font-size:11px;font-weight:750;letter-spacing:.06em;color:var(--orange)}
.count b{font-size:42px;font-weight:900;line-height:1.15;font-variant-numeric:tabular-nums;margin-top:4px}.count-label{font-size:12.5px;font-weight:700;color:var(--muted)}
.count.hot{border:2px solid var(--orange)}.count.hot b{color:var(--orange)}
.stage-label{position:absolute;left:16px;bottom:30px;color:#fff;pointer-events:none}.stage-label span{display:block;font-size:24px;font-weight:900;line-height:1.1;letter-spacing:.01em}.stage-label small{display:block;font-size:10.5px;font-weight:700;margin-top:12px;opacity:.95}
.kina{position:relative;align-self:end;justify-self:end;width:230px}.kina img{display:block;width:200px;margin-left:auto;filter:drop-shadow(0 10px 18px #0000002e)}
.bubble{position:absolute;right:190px;top:128px;width:250px;background:var(--bubble);color:var(--ink);border:2px solid var(--ink);border-radius:18px;padding:12px 14px;font-size:13.5px;font-weight:750;line-height:1.55;box-shadow:var(--shadow);z-index:2}
.bubble b{color:var(--orange);font-size:16px}.bubble::after{content:"";position:absolute;right:-11px;top:30px;width:16px;height:16px;background:var(--bubble);border-right:2px solid var(--ink);border-top:2px solid var(--ink);transform:rotate(45deg) skew(8deg,8deg)}
.bubble .more{display:block;margin-top:6px;font-size:12px;color:var(--muted)}
main{padding-bottom:64px}.block{margin-top:60px}.block-head{margin-bottom:16px}.block h2{font-size:27px;font-weight:850;line-height:1.4;margin-top:8px}.hint{color:var(--muted);font-size:13.5px;margin-top:6px;max-width:72ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px}.scroll{overflow-x:auto}.empty{padding:22px 20px;color:var(--muted)}
table{width:100%;border-collapse:collapse;min-width:760px}th{text-align:left;font-size:11.5px;font-weight:750;color:var(--muted);letter-spacing:.04em;padding:12px 16px;background:var(--soft);white-space:nowrap}
td{padding:15px 16px;border-top:1px solid var(--line);vertical-align:top}tbody tr{transition:background .15s}tbody tr:hover{background:var(--soft)}td:last-child{white-space:nowrap}
td b{font-weight:800}.num{font-variant-numeric:tabular-nums;white-space:nowrap}.sub{color:var(--muted);font-size:12.5px;margin-top:2px}.mute{color:var(--muted)}.kv{font-size:13px;margin-top:4px;overflow-wrap:anywhere}
code{background:var(--draft);color:var(--draftI);padding:1px 6px;border-radius:4px;font-size:12px}
.chip{display:inline-block;white-space:nowrap;font-size:11.5px;font-weight:700;line-height:1.6;padding:2px 10px;border-radius:999px;margin:2px 3px 2px 0;background:var(--draft);color:var(--draftI);vertical-align:1px}
.chip.pre{background:var(--pre);color:var(--preI)}.chip.ceil{background:var(--ceil);color:var(--ceilI)}.chip.spec{background:var(--spec);color:var(--specI)}
.chip.new{background:var(--new);color:var(--newI);font-weight:850;letter-spacing:.08em}.chip.upd{background:var(--upd);color:var(--updI);box-shadow:inset 0 0 0 1px var(--updB)}
.chip.okc{background:transparent;box-shadow:inset 0 0 0 1px var(--ok);color:var(--ok)}.chip.unread{background:var(--unread);color:var(--unreadI)}[hidden]{display:none!important}
button.ok{font:inherit;font-size:13px;font-weight:750;border:0;background:var(--ink);color:var(--paper);border-radius:6px;padding:7px 14px;cursor:pointer;transition:transform .15s}button.ok:hover{transform:translateY(-2px)}button.ok.copied{background:var(--ok);color:#fff}
.fold>summary{cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:750;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:7px 16px;margin-bottom:12px;list-style:none}.fold>summary::-webkit-details-marker{display:none}.fold>summary::before{content:"＋";color:var(--orange);font-weight:900}.fold[open]>summary::before{content:"−"}.fold>summary:hover{border-color:var(--orange)}
footer{border-top:1px solid var(--line)}footer .wrap{padding:26px 16px 40px;color:var(--muted);font-size:12.5px;line-height:1.9}footer .sig{font-size:11px;font-weight:750;letter-spacing:.06em;color:var(--ink);margin-bottom:8px}footer .sig b{color:var(--orange)}
@media (max-width:860px){.counts{grid-template-columns:repeat(2,minmax(0,1fr))}.stage .wrap{grid-template-columns:minmax(0,1fr);min-height:0}.stage-label{display:none}
.kina{width:100%;display:flex;align-items:flex-end;justify-content:flex-end;gap:16px;margin-top:8px}.kina img{width:150px;margin:0;flex:none}.bubble{position:relative;right:auto;top:auto;width:auto;max-width:340px;flex:0 1 auto;margin:0 0 72px}.bubble::after{top:auto;bottom:24px}}
@media (max-width:640px){.hero h1{font-size:34px}.hero-copy{padding-top:32px;padding-bottom:22px}.top-meta time{display:none}.kina img{width:118px}.bubble{margin-bottom:56px;font-size:13px}.count{padding:14px 14px 12px}.count b{font-size:34px}.block{margin-top:44px}.block h2{font-size:22px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}html{scroll-behavior:auto}}
</style></head><body>
<header class="top"><div class="wrap"><img class="brand" src="../public/editorial/assets/logo.png" alt="スロログ"><div class="top-meta"><span class="private">非公開</span><time>${ymd} 時点</time></div></div></header>
<div class="hero"><div class="wrap hero-copy"><p class="eyebrow"><b>LP BOARD</b>スロログ 機種ハブ</p><h1>LP 進行表</h1><p class="lead">候補 → 更新待ち → 完了。今週の動きと、あなたの OK 待ちがひと目でわかる。</p></div>
<div class="stage"><div class="band"></div><div class="wrap">
<nav class="counts" aria-label="件数">${count('#ok', 'OK', pending.length, 'OK 待ち', pending.length > 0)}${count('#queue', '01', queue.length, '候補')}${count('#wait', '02', waiting.length, '更新待ち')}${count('#done', '03', done.length, '完了')}</nav>
<div class="stage-label" aria-hidden="true"><span>CHECK.<br>OK.<br>PUBLISH.</span><small>powered by 回胴キナナ</small></div>
<div class="kina"><p class="bubble" role="status">${say}<span class="more" id="unreadMsg" hidden>週次レポートに未読があるよ</span></p><img src="../public/images/kina-chibi.webp" alt="ちびキナナ"></div>
</div></div></div>
<main class="wrap">
${section('ok', '<b>OK</b>WAITING FOR YOU', 'OK 待ち', '出典を確認 → ボタンで「A1 OK」をコピー → Claude に貼ると公開。', ['番号', '種類', '内容', '確認先'], rowsPending, 'なし。')}
${section('weekly', '<b>MON</b>WEEKLY REPORT', '週次レポート', '月曜のレポートと検証結果。開くと「未読」が消える。', ['週', '状態', '要点', '開く'], rowsWeekly, 'まだありません。')}
${section('recent', "<b>THIS WEEK</b>WHAT'S NEW", '今週の NEW と追加情報', latest ? `週次レポート ${esc(latest.date)} より（既報 ${knownN} 件は省略）。<b>NEW</b>＝LP 未掲載／<b>追加情報</b>＝既存機種の続報。` : `週次レポートの取り込みがまだありません。`, ['種類', '機種', '状態', '内容', '出所'], rowsRecent, '今週の動きなし。')}
${section('queue', '<b>01</b>CANDIDATES', '候補', 'LP 未掲載の機種。公式の出典が取れたら OK 待ちへ。', ['機種', '段階', '導入', '次の作業', '公式'], rowsQueue, 'なし。')}
${section('wait', '<b>02</b>IN PROGRESS', '更新待ち', '情報待ちの機種。ラベルが待っているもの。', ['機種', '導入', '待ち', 'リンク'], rowsWait, 'なし。')}
${section('done', '<b>03</b>COMPLETE', '完了', '情報が出そろった機種。公式ページの見張りだけ続ける。', ['機種', '導入', 'メモ', 'リンク'], rowsDone, 'なし。', done.length)}
</main>
<footer><div class="wrap"><p class="sig"><b>SLOLOG</b>powered by 回胴キナナ</p>完了の条件：型式名あり ＋ 公表値が決着（掲載済み／導入から 60 日たっても未公表）＋ 導入済み。<br>このページは <code>node scripts/lp-board.mjs</code> が作り直します（手で編集しない）。同じ内容の md は notes/LP_BOARD.md。</div></footer>
<script>(function(){var K='lpboard-read';var read={};try{read=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}var msg=document.getElementById('unreadMsg');function sync(){if(msg)msg.hidden=!document.querySelector('tr[data-week] .unread:not([hidden])')}document.querySelectorAll('tr[data-week]').forEach(function(tr){var d=tr.dataset.week;var u=tr.querySelector('.unread');if(u&&!read[d])u.hidden=false;tr.querySelectorAll('a.wk').forEach(function(a){['click','auxclick'].forEach(function(ev){a.addEventListener(ev,mark)});function mark(){read[d]=1;try{localStorage.setItem(K,JSON.stringify(read))}catch(e){}if(u)u.hidden=true;sync()}})});sync()})();document.querySelectorAll('button.ok').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch(e){}const t=b.textContent;b.textContent='コピーした';b.classList.add('copied');setTimeout(()=>{b.textContent=t;b.classList.remove('copied')},1200)}));
// 外部リンクは別ウィンドウで開く。「下書き」「出典」などリンクの名前ごとに 1 つの窓を使い回すので、下書きと出典を並べて見比べられる（⌘クリックはいつもどおり新しいタブ）
document.addEventListener('click',e=>{const a=e.target.closest('a[target="_blank"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;const w=window.open(a.href,'lpboard-'+a.textContent.trim(),'popup,width=1100,height=900');if(w){e.preventDefault();w.focus()}});</script></body></html>`;
writeFileSync('notes/LP_BOARD.html', html);
console.log(`notes/LP_BOARD.md と LP_BOARD.html を更新：OK 待ち ${pending.length}／候補 ${queue.length}／更新待ち ${waiting.length}／完了 ${done.length}`);

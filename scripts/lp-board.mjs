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
  // 天井の確認先（777パチガブ・必勝本）。verified / crosscheckUrl / watch のどこに書いてあっても拾う
  const refUrls = [...new Set([...fm.matchAll(/https:\/\/[^\s'"]*(?:p-gabu\.jp|hisshobon\.jp)[^\s'"]*/g)].map((x) => x[0]))];
  const refs = { gabu: refUrls.find((u) => u.includes('p-gabu.jp')), hissho: refUrls.find((u) => u.includes('hisshobon.jp')) };
  machines.push({ slug, name: one('name'), maker: one('maker'), rel, source: one('source'), draft: flag('draft'), wait, refs, ceiling: one('ceiling'), noCeiling: flag('noCeiling'),
    note: !hasSpec && specSettled && !flag('specNone') ? '公表値はメーカー未公表（導入から 60 日超）' : '' });
}
const byRel = (a, b) => (b.rel || '').localeCompare(a.rel || '');
const waiting = machines.filter((m) => m.wait.length).sort(byRel);
const done = machines.filter((m) => !m.wait.length).sort(byRel);
const pending = proposals.filter((p) => !p.appliedAt);
const weekly = load('notes/weekly/index.json', []).sort((x, y) => y.date.localeCompare(x.date));   // 週次レポート：下書き（未検証の原文）と検証結果

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
  for (const r of p.refs ?? []) md += `  - 天井の確認先：${r}\n`;
  if (p.note) md += `  - メモ：${p.note}\n`;
}
md += `\n## 📰 週次レポート\n\n`;
for (const w of weekly) md += `- ${w.date}｜${w.verified ? '検証済み（' + w.verifiedAt + '）' : '未検証'}｜${w.summary || ''}${w.verified ? '｜weekly/' + w.verified : ''}${w.draft ? '｜下書き weekly/' + w.draft : ''}\n`;
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
  if (m.refs.gabu || m.refs.hissho) md += `  - 天井の確認先：${m.refs.gabu ? 'パチガブ ' + m.refs.gabu : ''}${m.refs.gabu && m.refs.hissho ? '｜' : ''}${m.refs.hissho ? '必勝本 ' + m.refs.hissho : ''}\n`;
}
md += `\n## 🟢 完了（情報が出そろった。以後は見張りだけ）\n\n`;
for (const m of done) md += `- ${m.name}（${m.maker}）｜${m.rel}${m.note ? '｜' + m.note : ''}\n`;
md += `\n---\n\n判定の決まり：完了＝型式名あり＋天井が決着（あり／仕様上なし）＋公表値が決着（掲載済み／導入から 60 日たっても未公表）＋導入済み。\n完了した機種も \`watch-sources.mjs\` が見張り続け、公式ページに変化があれば「OK 待ち」に戻します。\n`;
writeFileSync('notes/LP_BOARD.md', md);

// ---- 見る用の表（notes/LP_BOARD.html）。中身は md と同じデータ。ブラウザで開く ----
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (u, label) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '<span class="mute">—</span>');
const chip = (t) => { const k = /導入前/.test(t) ? 'pre' : /天井/.test(t) ? 'ceil' : /公表値/.test(t) ? 'spec' : /下書き|型式/.test(t) ? 'draft' : 'etc'; return `<span class="chip ${k}">${esc(t)}</span>`; };
const refLinks = (r) => [r?.gabu ? link(r.gabu, 'パチガブ') : '', r?.hissho ? link(r.hissho, '必勝本') : ''].filter(Boolean).join(' · ');
const ceilCell = (m) => `${m.ceiling ? esc(m.ceiling) : m.noCeiling ? '<span class="mute">なし（仕様）</span>' : '<span class="mute">まだ</span>'}${refLinks(m.refs) ? `<div class="sub">${refLinks(m.refs)}</div>` : ''}`;
const rowsPending = pending.map((p) => `<tr><td><button class="ok" data-copy="${esc(p.id)} OK">${esc(p.id)}</button></td><td><span class="chip ${p.kind === 'new' ? 'pre' : 'ceil'}">${p.kind === 'new' ? '新しいページ' : '更新'}</span></td><td><b>${esc(p.name)}</b><div class="sub">${esc(p.summary)}</div>${Object.entries(p.changes ?? {}).map(([k, v]) => `<div class="kv"><code>${esc(k)}</code> → ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`).join('')}</td><td>${link(p.source, '出典を開く')}${p.crosscheck ? '<br>' + link(p.crosscheck, '照合先') : ''}${(p.refs ?? []).map((r) => '<br>' + link(r, r.includes('p-gabu') ? 'パチガブ' : '必勝本')).join('')}${p.slug ? '<br>' + link('file://' + process.cwd() + '/src/content/machines/' + p.slug + '.md', p.kind === 'new' ? '下書きの中身' : 'いまの中身') : ''}</td></tr>`).join('');
const rowsQueue = [...queue].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9)).map((q) => `<tr><td><b>${esc(q.name)}</b><div class="sub">${esc(q.maker || 'メーカー不明')}</div></td><td><span class="chip etc">${esc(q.stage)}</span></td><td class="num">${esc(q.release || '—')}</td><td>${esc(q.next)}${q.note ? `<div class="sub">${esc(q.note)}</div>` : ''}</td><td>${link(q.officialUrl, '公式')}</td></tr>`).join('');
const rowsWait = waiting.map((m) => `<tr><td><b>${esc(m.name)}</b><div class="sub">${esc(m.maker)}</div></td><td class="num">${esc(m.rel || '未定')}</td><td>${m.wait.map(chip).join(' ')}</td><td>${ceilCell(m)}</td><td>${m.draft ? '<span class="mute">非公開</span>' : link(SITE + m.slug + '/', 'LP')} · ${link(m.source, '出典')}</td></tr>`).join('');
const rowsDone = done.map((m) => `<tr><td>${esc(m.name)}<div class="sub">${esc(m.maker)}</div></td><td class="num">${esc(m.rel)}</td><td>${ceilCell(m)}</td><td class="sub">${esc(m.note || '')}</td><td>${link(SITE + m.slug + '/', 'LP')} · ${link(m.source, '出典')}</td></tr>`).join('');
const wfile = (f) => 'file://' + process.cwd() + '/notes/weekly/' + f;
const rowsWeekly = weekly.map((w) => `<tr data-week="${esc(w.date)}"><td class="num"><b>${esc(w.date)}</b></td><td>${w.verified ? `<span class="chip okc">検証済み ${esc(w.verifiedAt)}</span>` : '<span class="chip ceil">未検証</span>'} <span class="chip unread" hidden>未読</span></td><td>${esc(w.summary || '')}</td><td>${w.verified ? `<a class="wk" href="${esc(wfile(w.verified))}" target="_blank">検証結果</a>` : '<span class="mute">—</span>'}${w.draft ? ` · <a class="wk" href="${esc(wfile(w.draft))}" target="_blank">下書き</a>` : ''}</td></tr>`).join('');
const section = (id, title, hint, head, rows, empty) => `<section id="${id}"><h2>${title}</h2><p class="hint">${hint}</p>${rows ? `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">${empty}</p>`}</section>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LP 進行表</title><style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1c1d21;--mute:#6d707a;--line:#dedcd6;--accent:#d9650a;--pre:#e8eefc;--preI:#23408f;--ceil:#fdebd6;--ceilI:#8a4300;--spec:#ece8fb;--specI:#47318f;--draft:#ececec;--draftI:#4a4a4a;--ok:#1d7a46}
@media (prefers-color-scheme:dark){:root{--bg:#121317;--card:#1a1c22;--ink:#eceef2;--mute:#9a9eaa;--line:#2c2f38;--accent:#ff9a3f;--pre:#1c2748;--preI:#a9bcff;--ceil:#3a2710;--ceilI:#ffc98a;--spec:#271f45;--specI:#c9bcff;--draft:#2a2b30;--draftI:#c4c6cc;--ok:#52c787}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:1180px;margin:auto;padding:28px 16px 80px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:0 0 2px}.date{color:var(--mute)}
.counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0 8px}.count{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;text-decoration:none;color:inherit}
.count b{display:block;font-size:30px;line-height:1.2;font-variant-numeric:tabular-nums}.count span{color:var(--mute);font-size:13px}.count.hot b{color:var(--accent)}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-top:20px}.hint{color:var(--mute);margin:0 0 12px;font-size:13px}.empty{color:var(--mute);margin:0}
.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:720px}th{text-align:left;font-size:12px;color:var(--mute);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
td:last-child{white-space:nowrap}td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}.num{font-variant-numeric:tabular-nums;white-space:nowrap}.sub{color:var(--mute);font-size:12.5px}.mute{color:var(--mute)}
.kv{font-size:13px;margin-top:3px}code{background:var(--draft);padding:1px 5px;border-radius:4px;font-size:12px}a{color:var(--accent);text-underline-offset:3px}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.chip{display:inline-block;white-space:nowrap;font-size:12px;padding:2px 9px;border-radius:999px;margin:2px 2px 2px 0;background:var(--draft);color:var(--draftI)}.chip.pre{background:var(--pre);color:var(--preI)}.chip.ceil{background:var(--ceil);color:var(--ceilI)}.chip.spec{background:var(--spec);color:var(--specI)}.chip.okc{background:transparent;border:1px solid var(--ok);color:var(--ok)}.chip.unread{background:var(--accent);color:#fff}
button.ok{font:inherit;font-weight:700;border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:8px;padding:4px 12px;cursor:pointer}button.ok.copied{border-color:var(--ok);color:var(--ok)}
footer{color:var(--mute);font-size:12.5px;margin-top:24px}@media (max-width:640px){.counts{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style></head><body><main>
<h1>LP 進行表</h1><div class="date">${ymd} 時点 ／ スロログ 機種ハブ</div>
<div class="counts"><a class="count ${pending.length ? 'hot' : ''}" href="#ok"><b>${pending.length}</b><span>OK 待ち</span></a><a class="count" href="#queue"><b>${queue.length}</b><span>候補（ページなし）</span></a><a class="count" href="#wait"><b>${waiting.length}</b><span>更新待ち</span></a><a class="count" href="#done"><b>${done.length}</b><span>完了</span></a></div>
${section('ok', 'OK 待ち', '出典を開いて確かめ、左のボタンを押すと「A1 OK」がコピーされます。それを Claude に貼れば、その場で反映して公開します。', ['番号', '種類', '内容', '確認先'], rowsPending, 'いまはありません。')}
${section('weekly', '週次レポート', '月曜に届く下書きと、その検証結果。リンクを開くと「未読」が消えます（このブラウザだけの記録）。', ['週', '状態', '要点', '開く'], rowsWeekly, 'まだありません。')}
${section('queue', '候補（まだ LP にページがない）', '検定通過・メーカー公開・導入済みで未掲載の機種。メーカー公式の出典が取れたら「OK 待ち」に上がります。', ['機種', '段階', '導入', '次にやること', '公式'], rowsQueue, 'いまはありません。')}
${section('wait', 'LP 作成済み・更新待ち', '情報がまだ増える機種。色つきのラベルが「何を待っているか」です。', ['機種', '導入', '待っているもの', '天井と確認先', 'リンク'], rowsWait, 'ありません。')}
${section('done', '完了', '情報が出そろった機種。以後は見張りだけ続けます（公式ページに変化があれば OK 待ちに戻ります）。', ['機種', '導入', '天井と確認先', 'メモ', 'リンク'], rowsDone, 'ありません。')}
<footer>完了の条件：型式名あり ＋ 天井が決着（あり／仕様上なし）＋ 公表値が決着（掲載済み／導入から 60 日たっても未公表）＋ 導入済み。<br>このページは <code>node scripts/lp-board.mjs</code> が作り直します（手で編集しない）。同じ内容の md は notes/LP_BOARD.md。</footer>
</main><script>(function(){var K='lpboard-read';var read={};try{read=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}document.querySelectorAll('tr[data-week]').forEach(function(tr){var d=tr.dataset.week;var u=tr.querySelector('.unread');if(u&&!read[d])u.hidden=false;tr.querySelectorAll('a.wk').forEach(function(a){a.addEventListener('click',function(){read[d]=1;try{localStorage.setItem(K,JSON.stringify(read))}catch(e){}if(u)u.hidden=true})})})})();document.querySelectorAll('button.ok').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch(e){}const t=b.textContent;b.textContent='コピーした';b.classList.add('copied');setTimeout(()=>{b.textContent=t;b.classList.remove('copied')},1200)}));</script></body></html>`;
writeFileSync('notes/LP_BOARD.html', html);
console.log(`notes/LP_BOARD.md と LP_BOARD.html を更新：OK 待ち ${pending.length}／候補 ${queue.length}／更新待ち ${waiting.length}／完了 ${done.length}`);

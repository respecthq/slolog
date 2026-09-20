// メーカー公式ページに「情報が増えたか」を見張る。
//   node scripts/watch-sources.mjs          … 前回の記録と比べて、変化のあった機種だけ出す
//   node scripts/watch-sources.mjs --all    … 全機種の現在の状態を出す
// 見るページ：各機種の source と、frontmatter の watch（製品ページなど。任意・複数可）。
// 前回の状態は notes/source-snapshots.json（非公開）に保存する。初回は記録だけして終わる。
//
// 何をもって「増えた」とするか：
//   強い合図 … これまで無かった語（純増・天井・出玉率・設定・確率・導入日 など）が出た／表（table）が増えた／
//               スペックらしい名前の画像（spec・setting・data など）が増えた
//   弱い合図 … 本文の長さが大きく変わった（お知らせ欄の入れ替えでも起きるので、参考程度）
// 数値そのものは取り込まない。気づくための道具。載せるかどうかは人が出典を読んで決める。
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/machines';
const SNAP = 'notes/source-snapshots.json';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WORDS = ['純増', '天井', '出玉率', '機械割', '設定', '確率', '合成', 'ボーナス確率', '有利区間', '導入開始', '導入日', '年', 'スペック'];
const showAll = process.argv.includes('--all');

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function targets() {
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && !x.startsWith('_'))) {
    const fm = readFileSync(join(dir, f), 'utf8').split('---')[1] ?? '';
    if (/^draft:\s*true/m.test(fm) || /^fictional:\s*true/m.test(fm)) continue;
    const one = (k) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
    const urls = [one('source')];
    const w = fm.match(/^watch:\s*\n((?:\s+-\s+.*\n?)+)/m);
    if (w) for (const l of w[1].split('\n')) { const u = l.replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''); if (u) urls.push(u); }
    const all = [...new Set(urls.filter(Boolean))];
    const isRef = (u) => /p-gabu\.jp|hisshobon\.jp/.test(u);
    out.push({
      slug: f.replace(/\.md$/, ''), name: one('name'),
      urls: all.filter((u) => !isRef(u)),                 // メーカー側（公式）
      refs: all.filter(isRef),                            // 天井の確認に使う 2 媒体（watch に書いた分）
      needsCeiling: !one('ceiling') && !/^noCeiling:\s*true/m.test(fm),
      keyword: one('watchKeyword') || one('name').replace(/^(スマスロ|パチスロ|Lパチスロ|L)\s*/, '').split(/[\s　～~]/)[0],
    });
  }
  return out;
}

async function look(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (r.status !== 200) return { status: r.status };
  const html = await r.text();
  const text = strip(html);
  const words = Object.fromEntries(WORDS.map((w) => [w, text.split(w).length - 1]));
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1].split('?')[0].split('/').pop())
    .filter((n) => /spec|setting|settei|kakuritsu|data|table|tenjo/i.test(n));
  return { status: 200, len: text.length, tables: (html.match(/<table/g) || []).length, words, imgs: [...new Set(imgs)].sort() };
}

const prev = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : {};
const next = {};
const first = Object.keys(prev).length === 0;
let changed = 0;

for (const t of targets()) {
  for (const url of t.urls) {
    let now;
    try { now = await look(url); } catch (e) { now = { status: 'ERR ' + (e.cause?.code || e.name) }; }
    next[url] = { ...now, slug: t.slug, checkedAt: new Date().toISOString().slice(0, 10) };
    const old = prev[url];
    const notes = [];
    if (now.status !== 200) notes.push(`取得できない（${now.status}）`);
    else if (!old || old.status !== 200) { if (!first) notes.push('初めて記録（次回から比較）'); }
    else {
      const newWords = WORDS.filter((w) => (old.words?.[w] ?? 0) === 0 && now.words[w] > 0);
      const moreWords = WORDS.filter((w) => (old.words?.[w] ?? 0) > 0 && now.words[w] >= (old.words[w] + 3));
      if (newWords.length) notes.push(`★ 新しく出た語：${newWords.join('・')}`);
      if (now.tables > (old.tables ?? 0)) notes.push(`★ 表が増えた（${old.tables ?? 0} → ${now.tables}）`);
      const newImgs = now.imgs.filter((i) => !(old.imgs ?? []).includes(i));
      if (newImgs.length) notes.push(`★ スペックらしい画像が増えた：${newImgs.slice(0, 4).join(', ')}`);
      if (moreWords.length) notes.push(`語が増えた：${moreWords.join('・')}`);
      const diff = now.len - (old.len ?? 0);
      if (Math.abs(diff) > Math.max(400, (old.len ?? 0) * 0.25)) notes.push(`本文の長さが変わった（${diff > 0 ? '+' : ''}${diff} 字）`);
    }
    if (notes.length || showAll) {
      if (notes.length) changed++;
      console.log(`${notes.some((n) => n.startsWith('★')) ? '★' : notes.length ? '△' : '・'} ${t.slug}  ${t.name}`);
      console.log(`   ${url}`);
      for (const n of notes) console.log(`   ${n}`);
      if (showAll && now.status === 200) console.log(`   本文 ${now.len} 字／表 ${now.tables}／語 ${WORDS.filter((w) => now.words[w]).join('・') || 'なし'}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ---- 天井の見張り：メーカーは天井を公表しないので、確認に使う 2 媒体（777パチガブ・必勝本）を見る ----
// 対象は「天井が空で、天井なし（noCeiling）でもない」機種だけ。
//   ・watch に 2 媒体の URL があれば、そのページに天井の記載が出たかを見る
//   ・無ければ、機種名で 2 媒体を検索して「ページができた」ことを知らせる（URL は人が確かめて watch に足す。同名の旧機種・パチンコ版に注意）
const REF = {
  // minId：これより小さい番号のページは旧機種（同名シリーズの昔の台）とみなして候補にしない。年に一度、その年の新台の番号に合わせて上げる
  gabu: { label: '777パチガブ', host: 'p-gabu.jp', minId: 7000,
    search: (k) => 'https://p-gabu.jp/guideworks/machine?machine_keyword=' + encodeURIComponent(k),
    link: /href="(https:\/\/p-gabu\.jp\/guideworks\/machinecontents\/detail\/\d+)"[^>]*>([\s\S]*?)<\/a>/g,
    isSlot: (t) => !/^(e|P|PA|CR)\s?/.test(t),
    hasCeiling: (text) => /天井機能[\s\S]{0,300}?\d{2,4}\s*G/.test(text) },
  hissho: { label: '必勝本', host: 'hisshobon.jp', minId: 4700,
    search: (k) => 'https://p.hisshobon.jp/search?key=' + encodeURIComponent(k),
    link: /href="(\/machine\/\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g,
    isSlot: (t) => /^S/.test(t),
    hasCeiling: (text) => /天井\s*[&＆]\s*設定変更|天井[^。]{0,12}\d{3,4}\s*G/.test(text) },
};
const page = async (u) => { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); return r.status === 200 ? await r.text() : ''; } catch { return ''; } };
console.log('\n— 天井の見張り（777パチガブ・必勝本）—');
let ceilChanged = 0;
for (const t of targets().filter((x) => x.needsCeiling)) {
  const key = 'ceiling:' + t.slug; const old = prev[key] ?? {}; const now = {};
  const notes = [];
  for (const [id, site] of Object.entries(REF)) {
    const url = t.refs.find((u) => u.includes(site.host));
    if (url) {
      const has = site.hasCeiling(strip(await page(url)));
      now[id] = { url, has };
      if (has && !old[id]?.has) notes.push(`★ ${site.label}に天井の記載が出た  ${url}`);
    } else {
      const html = await page(site.search(t.keyword));
      const found = [...html.matchAll(site.link)].map((m) => [m[1].startsWith('/') ? 'https://p.hisshobon.jp' + m[1] : m[1], strip(m[2])])
        .filter(([u, title]) => title && title.includes(t.keyword) && site.isSlot(title) && Number(u.match(/(\d+)\/?$/)?.[1] ?? 0) >= site.minId);
      const uniq = [...new Map(found).entries()].slice(0, 3);
      now[id] = { url: null, candidates: uniq.map(([u]) => u) };
      const fresh = uniq.filter(([u]) => !(old[id]?.candidates ?? []).includes(u));
      for (const [u, title] of fresh) notes.push(`★ ${site.label}にページ候補：${title}  ${u}（確かめて watch に足す）`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (now.gabu?.has && now.hissho?.has) notes.push('★★ 2 媒体とも天井の記載あり → 数値が一致するか照合して、確認元つきで載せられる');
  next[key] = { ...now, checkedAt: new Date().toISOString().slice(0, 10) };
  const state = `パチガブ:${now.gabu?.url ? (now.gabu.has ? '天井あり' : '天井まだ') : 'ページ未登録'}／必勝本:${now.hissho?.url ? (now.hissho.has ? '天井あり' : '天井まだ') : 'ページ未登録'}`;
  if (notes.length) ceilChanged++;
  if (notes.length || showAll) { console.log(`${notes.length ? '★' : '・'} ${t.slug}  ${t.name}  [${state}]`); for (const n of notes) console.log('   ' + n); }
}
console.log(`天井が空の機種 ${targets().filter((x) => x.needsCeiling).length} 件／変化あり ${ceilChanged} 件`);

if (!existsSync('notes')) mkdirSync('notes');
writeFileSync(SNAP, JSON.stringify(next, null, 1));
const nPages = Object.keys(next).filter((k) => !k.startsWith('ceiling:')).length;
console.log(first ? `\n初回：${nPages} ページの状態を記録しました（次回から比較します）`
  : `\nメーカー公式 ${nPages} ページを確認／変化あり ${changed} 件（★＝載せられる情報が増えた可能性が高い）`);

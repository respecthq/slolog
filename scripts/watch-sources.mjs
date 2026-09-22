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
    if (/^fictional:\s*true/m.test(fm)) continue;   // 下書きも見張る（公開前に公式ページが更新されることがある）
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
      needsSpec: !(one('bonus') || one('payout') || one('junzo')) && !/^specNone:\s*true/m.test(fm),
      keyword: one('watchKeyword') || one('name').replace(/^(スマスロ|パチスロ|Lパチスロ|L)\s*/, '').split(/[\s　～~]/)[0],
    });
  }
  return out;
}

async function look(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (r.status !== 200) return { status: r.status };
  const html = await r.text();
  // SANKYO（sankyo-fever.jp）などは自動アクセスを弾く画面を 200 で返す。中身が無いので「読めない」として扱う
  if (/Incapsula|_Incapsula_Resource|cf-chl-bypass|Just a moment\.\.\./.test(html) && html.length < 20000) return { status: 'BLOCKED' };
  const text = strip(html);
  const words = Object.fromEntries(WORDS.map((w) => [w, text.split(w).length - 1]));
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1].split('?')[0].split('/').pop())
    .filter((n) => /spec|setting|settei|kakuritsu|data|table|tenjo/i.test(n));
  return { status: 200, len: text.length, tables: (html.match(/<table/g) || []).length, words, imgs: [...new Set(imgs)].sort() };
}

const ack = existsSync('notes/spec-ack.json') ? JSON.parse(readFileSync('notes/spec-ack.json', 'utf8')) : {};
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
    if (now.status === 'BLOCKED') notes.push('自動では読めない（ボット対策の画面）');
    else if (now.status !== 200) notes.push(`取得できない（${now.status}）`);
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
    // 変化が無くても、公表値待ちの機種の公式ページにスペックらしきもの（画像・表・出玉率など）があれば毎回知らせる。
    // 初回の記録時点ですでに載っていると「変化」にならず、見落とす（2026-09 のリコリス・リコイルで発生）
    if (now.status === 200 && t.needsSpec && !notes.some((n) => n.startsWith('★'))) {
      const sig = [...(now.imgs.length ? [`画像 ${now.imgs.slice(0, 3).join(', ')}`] : []), ...(now.tables ? [`表 ${now.tables}`] : []),
        ...['出玉率', '機械割', '純増'].filter((w) => now.words[w] > 0)];
      // 人が見て「スペックではなかった」と確かめたものは notes/spec-ack.json に URL→中身 を書いておくと、同じ中身の間は黙る
      if (sig.length && ack[url] !== sig.join('・')) notes.push(`★ 公表値待ちだが、公式ページにスペックらしきものがある：${sig.join('・')}（確認して違えば notes/spec-ack.json へ）`);
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

// 公表値待ちなのに、見張れるページが無い機種（PDF だけ／ボット対策で読めない）。ここは人がブラウザで見る
const manual = targets().filter((t) => t.needsSpec && !t.urls.some((u) => next[u]?.status === 200 && !/\.pdf$/i.test(u)));
if (manual.length) {
  console.log('\n🔒 自動で見張れない機種（公表値待ち）：メーカーの機種サイトをブラウザで開いて、スペック表が出ていないか見る');
  for (const t of manual) console.log(`   ${t.slug}  ${t.name}  ${t.urls.map((u) => `${u.split('/')[2]}${/\.pdf$/i.test(u) ? '（PDF）' : next[u]?.status === 'BLOCKED' ? '（読めない）' : ''}`).join(' ')}`);
}

// 天井の見張りは 2026-09-23 に廃止（天井・ゾーンは LP で扱わない）。メーカー公式ページの見張りだけ続ける

if (!existsSync('notes')) mkdirSync('notes');
writeFileSync(SNAP, JSON.stringify(next, null, 1));
writeFileSync('notes/watch-manual.json', JSON.stringify(manual.map((t) => t.slug)));   // 進行表が「手で確認」を出すのに使う
const nPages = Object.keys(next).filter((k) => !k.startsWith('ceiling:')).length;
console.log(first ? `\n初回：${nPages} ページの状態を記録しました（次回から比較します）`
  : `\nメーカー公式 ${nPages} ページを確認／変化あり ${changed} 件（★＝載せられる情報が増えた可能性が高い）`);

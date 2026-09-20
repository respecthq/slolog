#!/usr/bin/env node
/**
 * 転記ミス検出用のクロスチェック。
 * うちのデータ（メーカー名・導入日・出玉率・純増・天井）を、必勝本の該当ページ群と突き合わせて差分を出す。
 * 相手の数値を借りるためではなく、こちらの誤りを見つけるためのQAツール。
 *   node scripts/crosscheck.mjs [slug ...]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/machines';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const HB = 'https://p.hisshobon.jp';
// 数値が載っている可能性が高いページだけを見る（全ページ取ると相手に負荷がかかる）
const WANT = /基本スペック|天井|通常時解説|モードについて|規定ゲーム数|AT「|RUSH|ボーナス解説|周期/;
const MAX_PAGES = 9;

const fm = (t) => {
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const o = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (kv) o[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
    const cc = line.match(/^\s+crosscheck:\s*(\S+)/);
    if (cc) o.crosscheck = cc[1];
  }
  if (o.crosscheckUrl && !o.crosscheck) o.crosscheck = o.crosscheckUrl;
  return o;
};

const text = (html) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
// 中黒・空白・括弧書きの差で誤検知しないよう両側を潰す
const flat = (s) => (s || '').replace(/[（(][\s\S]*?[)）]/g, '').replace(/[\s・･]/g, '');

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const files = readdirSync(DIR).filter((f) => f.endsWith('.md'))
  .filter((f) => !args.length || args.includes(f.slice(0, -3)));

let checked = 0, issues = 0;
for (const f of files) {
  const d = fm(readFileSync(join(DIR, f), 'utf8'));
  const mid = d.crosscheck?.match(/p\.hisshobon\.jp\/machine\/(\d+)/)?.[1];
  if (!mid) continue;

  const top = await get(`${HB}/machine/${mid}`);
  if (!top) { console.log(`? ${f.slice(0, -3)}  機種ページを取得できなかった`); continue; }

  // 関連ページを集めて、ひとつの干し草の山にする
  const hits = [];
  for (const m of top.matchAll(/<a[^>]+href="(\/machine\/\d+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const label = m[2].replace(/<[^>]+>/g, '');
    if (WANT.test(label)) hits.push([m[1], label]);
  }
  // 基本スペック→天井→通常時解説 の順で必ず拾う（DOM順だと後ろに埋もれて漏れる）
  const rank = (l) => (/基本スペック/.test(l) ? 0 : /天井/.test(l) ? 1 : /通常時解説/.test(l) ? 2
    : /AT「|RUSH|上位/.test(l) ? 3 : 4);
  const urls = new Set(hits.sort((a, b) => rank(a[1]) - rank(b[1])).map(([u]) => u));
  let hay = text(top);
  for (const u of [...urls].slice(0, MAX_PAGES)) { hay += ' ' + text(await get(HB + u)); await wait(500); }
  const flatHay = flat(hay);

  checked++;
  const notes = [];
  if (d.maker) {
    // 「製造元（販売：販売元）」の形は、相手が販売元だけを載せていることが多い（例：銀座（販売：サミー））。
    // 製造元・販売元のどちらかが相手側にあれば一致とみなす
    const mine = flat(d.maker);
    const seller = flat((String(d.maker).match(/[（(]\s*販売\s*[：:]\s*([^)）]+)[)）]/) || [])[1] || '');
    const found = (mine && flatHay.includes(mine)) || (seller && flatHay.includes(seller));
    if (mine && !found) notes.push(`メーカー「${d.maker}」が相手側に見当たらない`);
  }
  if (d.released) {
    const [y, mo] = d.released.split('-');
    const want = `${y}年${Number(mo)}月`;
    if (y && mo && !hay.includes(want)) notes.push(`導入日「${want}」が相手側に見当たらない`);
  }
  if (d.payout) {
    const miss = [...new Set(d.payout.match(/\d+(?:\.\d+)?%/g) || [])].filter((v) => !hay.includes(v));
    if (miss.length) notes.push(`出玉率 ${miss.join(' / ')} が相手側に見当たらない`);
  }
  if (d.junzo) {
    const miss = [...new Set(d.junzo.match(/[\d.]+枚/g) || [])].filter((v) => !flatHay.includes(flat(v)));
    if (miss.length) notes.push(`純増 ${miss.join(' / ')} が相手側に見当たらない`);
  }
  if (d.ceiling) {
    const miss = [...new Set(d.ceiling.match(/\d{2,4}(?=G|pt)/g) || [])].filter((v) => !hay.includes(v));
    if (miss.length) notes.push(`天井の数値 ${miss.join(' / ')} が相手側に見当たらない`);
  }

  if (notes.length) {
    issues++;
    console.log(`\n★ ${f.slice(0, -3)}`);
    notes.forEach((n) => console.log(`   ${n}`));
    console.log(`   ${d.crosscheck}`);
  } else {
    console.log(`✓ ${f.slice(0, -3)}`);
  }
  await wait(700);
}
console.log(`\n照合 ${checked} 件 / 要確認 ${issues} 件`);

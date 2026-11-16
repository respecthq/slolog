// 業界紙の新着を毎日見て、LP にも候補にも無いパチスロ新台を候補（notes/lp-queue.json）に積む（2026-11-16〜）。
// 背景：新台の発表は平日ほぼ均等・午後2時〜夕方6時に多い（業界紙3紙の過去半年 78 件）。月曜朝の週報だけだと水〜金の発表を1週間取りこぼす。
// 読むもの：遊技通信・遊技日本・グリーンべるとの RSS（このMacからは読める。クラウドからはブロックされる）
// 積み方：見つけた機種は stage「メーカー発表（自動・未確認）」／検定通過の記事なら「検定通過」。見出しだけで判断しているので、必ず人（Claude）が本文で確かめてから進める。
//         LP か候補に既にある機種は、新しい記事が出たら候補の updatedAt・updateNote に記事を足す（LP の機種は進行表には出さず、ログだけ）。
// 実行：node scripts/news-watch.mjs        … 積んで進行表を作り直す
//       node scripts/news-watch.mjs --dry  … 何が見つかるかだけ表示
//       node scripts/news-watch.mjs --test … 既読を無視して、今フィードにある記事全部で試す（何も書かない）
// 自動実行：~/Library/LaunchAgents/com.respect.slolog.newswatch.plist（平日 19:00。Mac が寝ていたら起きたときに回る）
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TEST = process.argv.includes('--test');   // 既読を無視して今の記事で試す（何も書かない）
const DRY = TEST || process.argv.includes('--dry');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FEEDS = [
  ['遊技通信', 'https://www.yugitsushin.jp/feed/'],
  ['遊技日本', 'https://yugi-nippon.com/feed/'],
  ['グリーンべると', 'https://web-greenbelt.jp/feed/'],
];
const QUEUE = 'notes/lp-queue.json';
const SEEN = 'notes/news-seen.json';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 日本時間の日付

const unesc = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&#8211;/g, '–').replace(/&#82(16|17);/g, "'").replace(/&#82(20|21);/g, '"').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();

async function readFeed([src, url]) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
      src,
      title: unesc((it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? ''),
      link: unesc((it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? ''),
      date: new Date((it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? 0),
    }));
  } catch (e) {
    console.error(`✗ ${src} を読めなかった：${e.message}`);
    return [];
  }
}

// ---- 名前の正規化（「L／スマスロ／パチスロ／S」、全角半角、空白・記号の違いを無視） ----
const norm = (s) => s.normalize('NFKC').toLowerCase()
  .replace(/^(?:a-slot\+?|aslot\+?|lb\/?|l\/|スマスロ|スマート沖スロ|パチスロ|ぱちスロ|スロット|l(?=[^a-z]|$)|s(?=[^a-z]))\s*/g, '')
  .replace(/^(?:a-slot\+?|aslot\+?|スマスロ|パチスロ|ぱちスロ|スロット|lb|l)\s*/g, '')
  .replace(/[\s・\-–~〜～!！?？、。,.'"’“”「」『』（）()\[\]【】／/＋+&＆:：†☨]/g, '');
const core = (s) => norm(s).replace(/(?:bt|[a-z0-9]{1,4})$/g, '');   // 型式名の末尾の記号（UB・SC04H など）

const frontName = (f) => {
  const fm = readFileSync(`src/content/machines/${f}`, 'utf8').split('\n---')[0];
  return [(fm.match(/^name:\s*(.+)$/m) ?? [])[1], (fm.match(/^modelName:\s*(.+)$/m) ?? [])[1]].filter(Boolean).map((x) => x.replace(/^['"]|['"]$/g, ''));
};
const lpNames = readdirSync('src/content/machines').filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, ''), names: frontName(f) }));
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const seen = new Set(existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : []);
const firstRun = !TEST && !existsSync(SEEN);

const variants = (s) => {
  const out = [s, ...(s.match(/[（(]型式\s*([^）)]+)[）)]/) ?? []).slice(1)];
  return out.flatMap((x) => [norm(x.replace(/[（(].*?[）)]/g, '')), core(x.replace(/[（(].*?[）)]/g, ''))]).filter((x) => x.length >= 3);
};
const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
const findKnown = (name) => {
  const vs = variants(name);
  const q = queue.find((x) => variants(x.name).some((v) => vs.some((w) => same(v, w))));
  if (q) return { where: 'queue', item: q };
  const m = lpNames.find((x) => x.names.flatMap(variants).some((v) => vs.some((w) => same(v, w))));
  if (m) return { where: 'lp', item: m };
  return null;
};

// ---- 見出しからパチスロの機種名を取り出す ----
const SLOT_WORD = /パチスロ|スマスロ|スロット|ぱちスロ|BT機|A-?SLOT|沖スロ/;
const PACHINKO_ONLY = /^(?:e|P|PA|PF|CR)[A-Za-zぁ-んァ-ヶ一-龠]/;   // e〇〇・P〇〇・PA〇〇 はパチンコ
const SKIP = /決算|寄付|寄贈|協賛|コラム|グッズ|ポップアップ|キャンペーン|アプリ|販売本数|サウンドトラック|イベント|大会|求人|採用|セミナー|講話|白書|データブック|人事|清掃/;
function machinesIn(title) {
  if (SKIP.test(title)) return [];
  if (/検定通過|検定を通過/.test(title)) {
    // 例：「PAシャーマンキングSB、eソード…MJ6、LB/ゲッターマウスCC、LBデジスロSH2 などが検定通過」
    const head = title.replace(/(?:など|等)?(?:が|の)?検定(?:を)?通過.*$/, '').replace(/^[『「].*?[』」]/, (m) => m);
    return head.split(/[、,，]/).map((s) => s.replace(/^.*?[『「]|[』」].*$/g, '').trim())
      .filter((s) => /^(?:L|S|LB|A-?SLOT)/i.test(s.normalize('NFKC')) && !PACHINKO_ONLY.test(s))
      .map((name) => ({ name, kind: '検定通過' }));
  }
  if (!SLOT_WORD.test(title) && !/[『「]L[\s\S]*?[』」]/.test(title)) return [];
  if (!/新台|新機種|発表|発売|登場|公開|解禁|導入/.test(title)) return [];
  const names = [...title.matchAll(/[『「]([^』」]{2,40})[』」]/g)].map((m) => m[1].trim())
    .filter((n) => !PACHINKO_ONLY.test(n.normalize('NFKC')) || /スロ/.test(n));
  // 演出名・キャッチコピー（「全刈」「超王道」など）を機種名と取り違えないように：
  //  ①同じ見出しに知っている機種があれば、それだけを見る ②知らない名前は、頭がパチスロの型（L・LB・S・スマスロ・A-SLOT など）か「パチスロ新台「○○」」の形だけ
  const knownOnes = names.filter((n) => findKnown(n));
  if (knownOnes.length) return knownOnes.map((name) => ({ name, kind: '発表' }));
  const SLOT_HEAD = /^(?:L|LB|S|A-?SLOT|ASLOT|スマスロ|スマート|パチスロ|ぱちスロ|スロット|沖スロ)/i;
  return names.filter((n) => SLOT_HEAD.test(n.normalize('NFKC')) || new RegExp(`(?:パチスロ|スロット|スマスロ)新台[『「]${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[』」]`).test(title))
    .map((name) => ({ name, kind: '発表' }));
}

// ---- 実行 ----
const items = (await Promise.all(FEEDS.map(readFeed))).flat().sort((a, b) => a.date - b.date);
const added = [], followed = [], lpFollowed = [], unnamed = [];
for (const it of items) {
  if (!it.link || (!TEST && seen.has(it.link))) continue;
  seen.add(it.link);
  if (firstRun) continue;   // 初回は今ある記事を「見た」ことにするだけ（過去分で候補を埋めない）
  const found = machinesIn(it.title);
  if (!found.length && /【(?:パチスロ)?新台】|パチスロ新台|スマスロ新台/.test(it.title) && SLOT_WORD.test(it.title) && !SKIP.test(it.title) && !/スケジュール/.test(it.title)) {
    unnamed.push(`${it.src}「${it.title}」 ${it.link}`);
  }
  for (const { name, kind } of found) {
    const known = findKnown(name);
    const day = new Date(it.date.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
    const note = `${it.src} ${day}「${it.title}」`;
    if (!known) {
      if (added.some((a) => same(norm(a.name), norm(name)))) continue;
      added.push({ name, maker: '', stage: kind === '検定通過' ? '検定通過' : 'メーカー発表（自動・未確認）', release: '',
        next: '本文を読んで、メーカー・導入日・型式名を確かめる（自動で見つけた候補）', officialUrl: '',
        note: `自動で見つけた（見出しだけで判断・未確認）：${note}`, newsSource: it.link, foundAt: today, auto: true });
    } else if (known.where === 'queue') {
      const q = known.item;
      if ((q.updateNote ?? '').includes(it.link) || q.newsSource === it.link) continue;
      q.updatedAt = today;
      q.updateNote = `業界紙に新しい記事（自動）：${note} ${it.link}`;
      followed.push(`${q.name} ← ${note}`);
    } else {
      lpFollowed.push(`${known.item.slug} ← ${note}`);
    }
  }
}

const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
console.log(`【${stamp}】業界紙 ${items.length} 件を確認${firstRun ? '（初回：今ある記事を既読にしただけ）' : ''}`);
for (const a of added) console.log(`  🆕 候補に追加：${a.name}（${a.stage}）\n     ${a.newsSource}`);
for (const f of followed) console.log(`  ➕ 候補の続報：${f}`);
for (const f of lpFollowed) console.log(`  ・LP の機種の記事：${f}`);
for (const f of unnamed) console.log(`  ？ 見出しに機種名が無い新台記事（目で確かめる）：${f}`);
if (!added.length && !followed.length && !lpFollowed.length && !firstRun) console.log('  新しい新台の記事なし');

if (!DRY) {
  writeFileSync(SEEN, JSON.stringify([...seen].slice(-3000), null, 0));
  if (added.length || followed.length) {
    writeFileSync(QUEUE, JSON.stringify([...queue, ...added], null, 1));
    execFileSync(process.execPath, ['scripts/lp-board.mjs'], { stdio: 'inherit' });
  }
  if (added.length || followed.length) {
    const msg = [added.length ? `新台候補 ${added.length} 件` : '', followed.length ? `候補の続報 ${followed.length} 件` : ''].filter(Boolean).join('・');
    try { execFileSync('osascript', ['-e', `display notification "${msg}（進行表に出ています）" with title "スロログ 新台の見張り"`]); } catch {}
  }
}

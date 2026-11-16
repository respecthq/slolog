// 業界紙の新着を毎日見て、LP にも候補にも無いパチスロ新台を候補（notes/lp-queue.json）に積む（2026-11-16〜）。
// 背景：新台の発表は平日ほぼ均等・午後2時〜夕方6時に多い（業界紙3紙の過去半年 78 件）。月曜朝の週報だけだと水〜金の発表を1週間取りこぼす。
// 読むもの：遊技通信・遊技日本・グリーンべるとの RSS（このMacからは読める。クラウドからはブロックされる）
//   ＋（2026-11-17〜）メーカー公式 YouTube の新着動画（scripts/maker-channels.json の RSS）：メーカーは業界紙の記事より先にティザーを出す
//   ＋（2026-11-17〜）新台スケジュールの記事（遊技日本・グリーンべると）を前回と読み比べ、増えた機種・日付が入った機種を知らせる
//   きっかけ：戦国†恋姫2（日付はスケジュール記事とホール向け資料にしか無かった）とシスクエ（カルミナの YouTube・X だけ）を取りこぼした
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
const SNAP = 'notes/schedule-snapshot.json';
const CHANNELS = JSON.parse(readFileSync('scripts/maker-channels.json', 'utf8')).channels;
const SCHEDULES = [
  ['遊技日本', 'https://yugi-nippon.com/newmachine-list/post-28190/'],
  ['グリーンべると', 'https://web-greenbelt.jp/post-115093/'],
];
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
const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[―‐‑−ｰ]/g, 'ー')
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


// ---- メーカー公式 YouTube ----
async function readChannel(c) {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
      c, title: unesc((e.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? ''),
      link: (e.match(/<link rel="alternate" href="([^"]+)"/) ?? [])[1] ?? '',
      date: new Date((e.match(/<published>([^<]+)<\/published>/) ?? [])[1] ?? 0),
    }));
  } catch (e) {
    console.error(`✗ YouTube ${c.maker}（${c.channel}）を読めなかった：${e.message}`);
    return null;
  }
}
const NEW_VIDEO = /PV|ティザー|ティーザー|新機種|新台|機種紹介|先行|プロモーション|予告|導入|発売|CM|ムービー/i;
const PACHINKO_VIDEO = /パチンコ|ぱちんこ|【\s*[eP][A-Za-zぁ-んァ-ヶ一-龠]|^\s*[eP][A-Za-z]{0,2}[ぁ-んァ-ヶ一-龠]|スマパチ|甘デジ|ハネモノ|はねもの/;
const SLOT_VIDEO = /スロ|BT|A-?SLOT|【\s*L|^\s*L[A-Zぁ-んァ-ヶ一-龠]|[\s「『【]L[ぁ-んァ-ヶ一-龠]/;
const GENERIC = /^(?:PV|ティザー\s*PV|ティザー|ティーザー|新機種|新台|機種紹介|公式|先行映像|予告|スロット|パチスロ|スマスロ|プロモーション\s*ムービー|.*公式|ショート|shorts)$/i;
function videoNames(title) {
  const t = title.normalize('NFKC').replace(/#\S+/g, ' ');
  const parts = t.split(/[【】「」『』《》〈〉<>\[\]｜|／/!！]+/)
    .map((x) => x.replace(/\s*(?:機種紹介|ティザー|ティーザー|プロモーション\s*(?:ムービー|ビデオ)?|先行映像|PV|予告|ムービー|公式|導入.*|全国.*)+\s*$/i, '').replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 2 && !GENERIC.test(x));
  return parts.length ? parts : [t.trim()];
}

// ---- 新台スケジュールの記事 ----
async function readSchedule([src, url]) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const html = await res.text();
    const lines = unesc(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n')).split('\n').map((x) => x.trim()).filter(Boolean);
    const out = [];
    let date = null, slot = false;
    const now = new Date(Date.now() + 9 * 3600e3);
    for (const x of lines) {
      if (/～新台噂～|新台噂|関連記事|この記事を書いた/.test(x)) { if (date) break; else continue; }
      const m = x.length < 16 && x.match(/^●?\s*(\d{1,2})月(\d{1,2})日\s*(?:導入|予定)?/);
      if (m) {
        const mo = +m[1], y = mo >= now.getUTCMonth() ? now.getUTCFullYear() : now.getUTCFullYear() + 1;   // 先月以前の月は来年
        date = `${y}-${String(mo).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; slot = false; continue;
      }
      if (/^●?\s*近日(?:予定|導入)/.test(x)) { date = '近日'; slot = false; continue; }
      if (/^検定通過済み/.test(x)) { date = '検定通過済み'; slot = false; continue; }
      if (/^・?パチスロ$/.test(x)) { slot = true; continue; }
      if (/^・?パチンコ$/.test(x)) { slot = false; continue; }
      if (!date || !slot) continue;
      if (x.length > 50 || /記事を読む|googletag|[{};]|。/.test(x)) continue;
      const mm = x.match(/^(.+?)[（(]([^）)]+)[）)]$/);
      out.push({ src, url, name: mm ? mm[1].trim() : x, maker: mm ? mm[2].trim() : '', date });
    }
    if (!out.length) console.error(`✗ ${src}のスケジュールから機種を読み取れなかった（ページの形が変わった？）：${url}`);
    return out;
  } catch (e) {
    console.error(`✗ ${src}のスケジュールを読めなかった：${e.message}`);
    return [];
  }
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


// ---- メーカー公式 YouTube の新着 ----
const videos = [], ytFailed = [];
for (const list of await Promise.all(CHANNELS.map(readChannel))) {
  if (!list) { ytFailed.push(1); continue; }
  videos.push(...list);
}
const ytFound = [];
for (const v of videos.sort((a, b) => a.date - b.date)) {
  if (!v.link) continue;
  const init = `yt-init:${v.c.id}`;
  const firstCh = !TEST && !seen.has(init);
  if (!TEST && seen.has(v.link)) continue;
  seen.add(v.link);
  if (firstCh) continue;   // そのチャンネルを初めて見たときは、今ある動画を既読にするだけ
  const t = v.title.normalize('NFKC');
  if (!NEW_VIDEO.test(t) || (PACHINKO_VIDEO.test(t) && !/スロ/.test(t)) || !(SLOT_VIDEO.test(t) || /スロ/.test(t))) continue;
  const day = new Date(v.date.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const note = `${v.c.maker}公式 YouTube ${day}「${v.title}」 ${v.link}`;
  const id = (v.link.match(/v=([\w-]{11})/) ?? [])[1] ?? v.link;
  const known = videoNames(v.title).map((n) => findKnown(n)).find(Boolean);
  ytFound.push(note);
  if (!known) {
    let name = videoNames(v.title).find((n) => /^(?:L|LB|S|A-?SLOT|スマスロ|パチスロ)/i.test(n)) ?? videoNames(v.title)[0];
    if (/新機種|ティザー|^NEW$|速報|^パチスロ$/i.test(name)) name = `${v.c.maker}の新機種（名前未確認）`;
    const dup = added.find((a) => a.officialUrl === v.link || (!/名前未確認/.test(name) && same(norm(a.name), norm(name))));
    if (dup) { dup.note += `／別の動画：${v.link}`; continue; }
    added.push({ name, maker: v.c.maker, stage: 'メーカー公開（公式動画・自動・未確認）', release: '',
      next: '動画を見て機種名を確かめる。導入日が2か所で一致したら NEW 提案（PIPELINE.md 段階1）', officialUrl: v.link,
      note: `自動で見つけた（動画タイトルだけで判断・未確認）：${note}`, newsSource: v.link, foundAt: today, auto: true });
  } else if (known.where === 'queue') {
    const q = known.item;
    if ([q.note, q.updateNote, q.officialUrl, q.newsSource].join(' ').includes(id)) continue;
    q.updatedAt = today;
    q.updateNote = `公式動画（自動）：${note}`;
    followed.push(`${q.name} ← ${note}`);
  } else {
    const fm = readFileSync(`src/content/machines/${known.item.slug}.md`, 'utf8');
    if (fm.includes(id) || /^pv:/m.test(fm) || !/PV|ティザー|ティーザー|プロモーション/i.test(t)) continue;   // LP の機種は「PV が未登録で、PV らしい動画が出た」ときだけ
    lpFollowed.push(`${known.item.slug} ← ${note}${/^pv:/m.test(fm) ? '' : '（PV 未登録 → changes.pv の提案を）'}`);
  }
}

// ---- 新台スケジュールの読み比べ ----
const sched = (await Promise.all(SCHEDULES.map(readSchedule))).flat();
const prevSnap = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : null;
const snap = {};
for (const e of sched) (snap[e.src] ??= {})[norm(e.name)] = { name: e.name, maker: e.maker, date: e.date };
const schedNews = [];
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
for (const e of sched) {
  const before = prevSnap?.[e.src]?.[norm(e.name)];
  const changed = prevSnap && (!before || before.date !== e.date);
  const known = findKnown(e.name);
  const others = sched.filter((x) => x.src !== e.src && same(norm(x.name), norm(e.name)) && x.date === e.date).map((x) => x.src);
  const label = `${e.src}のスケジュール：${e.date === '近日' || e.date === '検定通過済み' ? e.date : e.date + ' 導入予定'}${others.length ? `（${others.join('・')}も同じ＝2か所一致）` : ''}`;
  if (known?.where === 'queue') {
    const q = known.item;
    if (!isDate(e.date) || (q.release ?? '').startsWith(e.date)) continue;
    if ((q.updateNote ?? '').includes(label) || ((q.updateNote ?? '').includes('日付が出た（自動）') && (q.updateNote ?? '').includes(e.date))) continue;
    q.updatedAt = today;
    q.updateNote = `日付が出た（自動）：${label} ${e.url}`;
    followed.push(`${q.name} ← ${label}`);
  } else if (known?.where === 'lp') {
    const rel = (readFileSync(`src/content/machines/${known.item.slug}.md`, 'utf8').match(/^released:\s*(\S+)/m) ?? [])[1] ?? '';
    if (changed && isDate(e.date) && rel && rel !== e.date) lpFollowed.push(`${known.item.slug} ← ${label}（LP は ${rel}・日付ちがい？）`);
  } else if (changed || (!prevSnap && isDate(e.date))) {
    if (e.date === '検定通過済み') { schedNews.push(`${e.name}（${e.maker}）← ${label}`); continue; }
    if (added.some((a) => same(norm(a.name), norm(e.name)))) continue;
    added.push({ name: e.name, maker: e.maker, stage: 'スケジュール掲載（自動・未確認）', release: isDate(e.date) ? e.date : '',
      next: 'メーカーの機種ページか公式動画を探す。導入日が2か所で一致したら NEW 提案（PIPELINE.md 段階1）', officialUrl: '',
      note: `自動で見つけた（スケジュール記事の一覧から・未確認）：${label}`, newsSource: e.url, foundAt: today, auto: true });
  }
}

const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
console.log(`【${stamp}】業界紙 ${items.length} 件・メーカー公式 YouTube ${CHANNELS.length - ytFailed.length}/${CHANNELS.length} チャンネル（動画 ${videos.length} 本）・スケジュール ${sched.length} 件を確認${firstRun ? '（初回：今ある記事を既読にしただけ）' : ''}`);
for (const a of added) console.log(`  🆕 候補に追加：${a.name}（${a.stage}）\n     ${a.newsSource}`);
for (const f of followed) console.log(`  ➕ 候補の続報：${f}`);
for (const f of lpFollowed) console.log(`  ・LP の機種の記事：${f}`);
for (const f of ytFound) console.log(`  ▶ 新しい公式動画：${f}`);
for (const f of schedNews) console.log(`  📅 スケジュールの検定通過済み欄に追加：${f}`);
for (const f of unnamed) console.log(`  ？ 見出しに機種名が無い新台記事（目で確かめる）：${f}`);
if (!added.length && !followed.length && !lpFollowed.length && !firstRun) console.log('  新しい新台の記事なし');

if (!DRY) {
  for (const c of CHANNELS) seen.add(`yt-init:${c.id}`);
  writeFileSync(SEEN, JSON.stringify([...seen].filter((x) => x.startsWith('yt-init:')).concat([...seen].filter((x) => !x.startsWith('yt-init:')).slice(-3000)), null, 0));
  if (sched.length) writeFileSync(SNAP, JSON.stringify(snap, null, 1));
  if (added.length || followed.length) {
    writeFileSync(QUEUE, JSON.stringify([...queue, ...added], null, 1));
    execFileSync(process.execPath, ['scripts/lp-board.mjs'], { stdio: 'inherit' });
  }
  if (added.length || followed.length) {
    const msg = [added.length ? `新台候補 ${added.length} 件` : '', followed.length ? `候補の続報 ${followed.length} 件` : ''].filter(Boolean).join('・');
    try { execFileSync('osascript', ['-e', `display notification "${msg}（進行表に出ています）" with title "スロログ 新台の見張り"`]); } catch {}
  }
}

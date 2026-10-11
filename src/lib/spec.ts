import type { CollectionEntry } from 'astro:content';

/**
 * LP↔アプリの契約「slolog.machine」型。
 * メーカー公表事実のみ。狙い目/ヤメ時・期待値は含めない（各自がアプリの期待値メモで入れる）。
 * アプリ側 lib/data/machine_spec.dart の parseMachineSpecs と対になる。
 */
export type MachineSpec = {
  type: 'slolog.machine';
  v: 1;
  id: string; // 機種のスラッグ（安定ID）。アプリは lpId として保存し、名前より先に同一判定に使う
  name: string;
  maker: string;
  ceiling: string; // 2026-09-23〜 常に空（天井・ゾーンは扱わない。契約 v1 の形を保つため項目だけ残す）
  junzo: string;
  zone: string;    // 同上
  released: string;
  koyaku?: string;
  gen?: string;     // 号機区分（アプリの号機チップ）
  machineType?: string; // 実機のタイプ（ノーマル／AT など）。契約識別子 type とは別の項目（監査 F11）
  modelName?: string; // 型式名（検定上の正式名）
  bonus?: string;   // ボーナス合成確率（メーカー公表）
  payout?: string;  // 出玉率＝機械割（メーカー公表）
  memo?: string;    // アプリ側は memo をそのまま機種メモに使う
  source?: string; // 出典URL（トレーサビリティ）
  settei?: Settei; // 2026-10-10〜 設定別の確率（メーカー公表の表だけ・Aタイプの BIG/REG。アプリの設定判別に使う）
  image?: { url: string; credit: string }; // 2026-10-12〜 筐体画像（アプリ内で使ってよいと許諾を得たメーカーだけ。APP_IMAGE_MAKERS）
};

/** 設定別の確率（メーカー公表）。denoms[i] は settings[i] の設定の分母（1/273.1 → 273.1） */
export type Settei = {
  settings: number[]; // 設定の番号（設定3が無い機種は [1,2,4,5,6] など。表の行の順）
  roles: { name: string; kind: string; denoms: number[] }[]; // kind：アプリが重なりを判定する種類（big_total / reg_total）
  counter?: CounterRole[]; // 機種専用の小役カウンタで数える役（確率は持たない。公表値の無い小役は Pro の人が自分の値を入れる）
  payout?: number[]; // 設定ごとの出玉率（%）
  note?: string;     // 「※独自調査値」などメーカーの但し書き
  count?: string;    // 数え方の注意（BT 機の「通常時だけ数える」など）。アプリの小役カウンタに出す
};

/**
 * 機種専用の小役カウンタの 1 役。group の中は同じゲームで重ならない役だけにする
 * （bonus＝BIG・REG と、それらと同じゲームで重ならない役／koyaku＝ボーナスと重なりうる小役／bt＝BT中の役。分母は BT中のゲーム数）。
 * アプリはグループごとに多項分布を出して掛け合わせる（けんのスロットと同じ考え方）。
 * 数える役は、攻略メディアの判別ツール（なな徹・けんのスロット・一撃）が数えている要素から、
 * 通常時に数えやすいものを選ぶ。役の名前だけで、確率（各社の独自調査値）は配らない。
 */
export type CounterRole = { name: string; kind: string; group: 'bonus' | 'koyaku' | 'bt' };

/**
 * アプリ内で筐体画像を使ってよいと許諾を得たメーカー（notes/MAKER_PERMISSIONS.md の「アプリ内で画像」が ✅ のもの）。
 * 北電子＝2026-09-24 回答で OK（バックアップ ZIP への同梱も OK）。ほかのメーカーは許諾が出るまで足さない
 */
const APP_IMAGE_MAKERS = new Set(['北電子']);
const SITE_ORIGIN = 'https://respecthq.github.io/slolog/';

const BONUS: CounterRole[] = [
  { name: 'BIG', kind: 'big_total', group: 'bonus' },
  { name: 'REG', kind: 'reg_total', group: 'bonus' },
];

/**
 * 本文の「設定別スペック」の表（<!-- spec:begin --> 〜 <!-- spec:end -->。メーカー公式から取り込んだもの）を
 * 設定判別用のデータにする。合成・合算は BIG と REG の重複なので使わない。読めない列は捨てる。
 */
export function parseSettei(body: string | undefined, note?: string): Settei | undefined {
  const block = body?.match(/<!-- spec:begin -->([\s\S]*?)<!-- spec:end -->/)?.[1];
  if (!block) return undefined;
  const rows = block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l))
    .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
  if (rows.length < 3) return undefined;
  const [head, ...data] = rows;
  if (!/設定/.test(head[0])) return undefined;
  const settings = data.filter((r) => /^\d$/.test(r[0]));
  if (settings.length < 2) return undefined;
  const roleName = (h: string) => {
    const n = h.replace(/確率$/, '').trim();
    if (/^(BB|BIG)(合算)?$/i.test(n)) return 'BIG'; // 「BIG合算」＝スーパービッグなどを含む BIG 全体（ケロット5BT）
    if (/^(RB|REG)$/i.test(n)) return 'REG';
    return n;
  };
  const roles: Settei['roles'] = [];
  let payout: number[] | undefined;
  head.forEach((h, i) => {
    if (i === 0 || (/合成|合算/.test(h) && !/^(BB|BIG)合算/i.test(h))) return;
    if (/出玉率|機械割/.test(h)) {
      const v = settings.map((r) => Number((r[i] ?? '').replace(/[%％\s]/g, '')));
      if (v.every((x) => Number.isFinite(x) && x > 50 && x < 200)) payout = v;
      return;
    }
    const v = settings.map((r) => Number((r[i] ?? '').match(/^1\/([\d.,]+)$/)?.[1]?.replace(/,/g, '')));
    if (v.every((x) => Number.isFinite(x) && x > 1)) roles.push({ name: roleName(h), denoms: v });
  });
  // いまはAタイプ（BIG・REG）だけ。AT機の初当りは、通常時のゲーム数の数え方が機種ごとに違うので出さない（2026-10-10 ユーザー判断）
  const ab = roles
    .filter((r) => r.name === 'BIG' || r.name === 'REG')
    .map((r) => ({ name: r.name, kind: r.name === 'BIG' ? 'big_total' : 'reg_total', denoms: r.denoms }));
  if (!ab.length) return undefined;
  return {
    settings: settings.map((r) => Number(r[0])),
    roles: ab,
    ...(payout ? { payout } : {}),
    ...(note ? { note } : {}),
  };
}

/** 機種エントリ → 配信用スペックJSONオブジェクト */
export function toSpec(entry: CollectionEntry<'machines'>): MachineSpec {
  const d = entry.data;
  const spec: MachineSpec = {
    type: 'slolog.machine',
    v: 1,
    id: entry.id,
    name: d.name,
    maker: d.maker, // 業界での表記（P-WORLD・ぱちタウンの「メーカー」欄と同じ）
    ceiling: '',
    junzo: d.junzo,
    zone: '',
    released: d.released,
  };
  if (d.koyaku) spec.koyaku = d.koyaku;
  if (d.gen) spec.gen = d.gen;
  if (d.type) spec.machineType = d.type;
  if (d.modelName) spec.modelName = d.modelName;
  if (d.bonus) spec.bonus = d.bonus;
  if (d.payout) spec.payout = d.payout;
  // 現行アプリは bonus/payout を直接は読まないので、memo に畳んで機種メモへ出す。
  const notes = [
    d.type ? `タイプ ${d.type}` : '',
    d.bonus ? `ボーナス合成 ${d.bonus}` : '',
    d.payout ? `出玉率 ${d.payout}` : '',
    (d.bonus || d.payout) && d.specNote ? d.specNote : '',
    d.bonusPayout ? `ボーナス ${d.bonusPayout}` : '',
  ].filter(Boolean);
  if (notes.length) spec.memo = notes.join(' ／ ');
  if (d.source) spec.source = d.source;
  // 設定判別のデータ（設定別の BIG・REG＋機種専用の小役カウンタ）は、機種 md の counter で
  // bonus（BIG・REG だけ）か detail（小役も数える）と決めた機種だけ配る（判断の順は PIPELINE.md「小役カウンタ」）
  const c = d.counter;
  const judge = c && (c.status === 'bonus' || c.status === 'detail');
  const settei = judge ? parseSettei(entry.body, d.specNote) : undefined;
  if (settei && c) {
    spec.settei = {
      ...settei,
      counter: c.status === 'detail' ? c.roles : BONUS,
      ...(c.count ? { count: c.count } : {}),
    };
  }
  // 筐体画像（許諾を得たメーカーだけ・権利表記つき）。アプリは公式の配信から来たこの URL だけを取りに来る
  if (d.image && APP_IMAGE_MAKERS.has(d.maker) && d.image.credit) {
    spec.image = { url: SITE_ORIGIN + d.image.src, credit: d.image.credit };
  }
  return spec;
}

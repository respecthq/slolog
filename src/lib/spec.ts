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
};

/** 設定別の確率（メーカー公表）。denoms[i] は settings[i] の設定の分母（1/273.1 → 273.1） */
export type Settei = {
  settings: number[]; // 設定の番号（設定3が無い機種は [1,2,4,5,6] など。表の行の順）
  roles: { name: string; kind: string; denoms: number[] }[]; // kind：アプリが重なりを判定する種類（big_total / reg_total）
  detail: boolean; // 自分の判別値（ぶどう・単独REG など）を足した細かい判別を確かめた機種か
  payout?: number[]; // 設定ごとの出玉率（%）
  note?: string;     // 「※独自調査値」などメーカーの但し書き
  count?: string;    // 数え方の注意（BT 機の「通常時だけ数える」など）。アプリの小役カウンタに出す
};

/**
 * ジャグラー系のほかに設定判別を配る機種（2026-10-11〜）。条件：
 *   ・メーカーが設定別の BIG・REG を公表している
 *   ・攻略メディアの設定判別ツールが、同じ公表値で BIG・REG の判別をしている（数え方を確かめられる）
 * 細かい判別（自分の判別値を足す）は確かめていないので detail は付けない
 */
const BT_COUNT = 'BT中のゲーム数とボーナスは数えず、通常時のゲーム数と通常時に引いた BIG・REG だけを数えてください';
const SETTEI_EXTRA: Record<string, { count: string; checked: string[] }> = {
  // なな徹「設定推測ツール（簡易版）」が 前任者の総G/BIG/REG＋通常時の消化G/BIG/REG を 1/278.9・1/434.0（公表値）で判別
  matador3: { count: BT_COUNT, checked: ['https://nana-press.com/kaiseki/machine/997/suisoku2/'] },
  // なな徹が 通常時消化G・BIG・REG を 1/299.3・1/383.3 … 1/240.1・1/247.3（公表値）で判別。けんのスロット・一撃も同じ公表値
  'crea-bonus-trigger': {
    count: BT_COUNT,
    checked: ['https://nana-press.com/kaiseki/machine/1006/suisoku/', 'https://kenslo65536.com/hanbetsu/lb-crea.html'],
  },
  // なな徹（SBIG・BIG を半分ずつ）・けんのスロット（BIG 合算）が 合計ゲーム数と公表値 1/232.4・1/350.5 … で判別。BIG の公表値はスーパービッグを含む合算
  kerotto5bt: {
    count: 'BIG はスーパービッグとビッグを合わせて数えてください（メーカーの公表値が合算のため）',
    checked: ['https://nana-press.com/kaiseki/machine/1170/suisoku2/', 'https://kenslo65536.com/hanbetsu/lb-kelot5.html'],
  },
  // 一撃が 通常G数・BB・RB、けんのスロットが 回転数・BIG・REG を公表値（設定1・2・5・6）で判別。BT は JAC で別に数える
  'shake-bonus-trigger': {
    count: BT_COUNT,
    checked: ['https://1geki.jp/slot/lb_shake/99/', 'https://kenslo65536.com/hanbetsu/lb-shake.html'],
  },
};

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
    detail: false, // toSpec で機種ごとに決める
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
  // 設定判別のデータは、前提（BIG・REG・小役が同じゲームで重ならない分け方）を確かめた北電子のジャグラー系だけ（2026-10-11）。
  // 細かい判別（自分の判別値を足す）は、ボーナスの同時抽選が単独・チェリー重複だけの機種に限る。
  // ミスタージャグラーはピエロとの同時抽選もある（北電子公式）ので BIG・REG の判別だけ
  const isJuggler = d.maker === '北電子' && /ジャグラー/.test(d.name);
  const extra = SETTEI_EXTRA[entry.id];
  const settei = isJuggler || extra ? parseSettei(entry.body, d.specNote) : undefined;
  if (settei) {
    spec.settei = {
      ...settei,
      detail: isJuggler && !/ミスタージャグラー/.test(d.name),
      ...(extra ? { count: extra.count } : {}),
    };
  }
  return spec;
}

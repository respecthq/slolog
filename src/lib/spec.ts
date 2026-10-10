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
    if (/^(BB|BIG)$/i.test(n)) return 'BIG';
    if (/^(RB|REG)$/i.test(n)) return 'REG';
    return n;
  };
  const roles: Settei['roles'] = [];
  let payout: number[] | undefined;
  head.forEach((h, i) => {
    if (i === 0 || /合成|合算/.test(h)) return;
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
  const settei = isJuggler ? parseSettei(entry.body, d.specNote) : undefined;
  if (settei) spec.settei = { ...settei, detail: !/ミスタージャグラー/.test(d.name) };
  return spec;
}

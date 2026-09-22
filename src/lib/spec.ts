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
  cabinet?: string; // 筐体
  modelName?: string; // 型式名（検定上の正式名）
  bonus?: string;   // ボーナス合成確率（メーカー公表）
  payout?: string;  // 出玉率＝機械割（メーカー公表）
  memo?: string;    // アプリ側は memo をそのまま機種メモに使う
  source?: string; // 出典URL（トレーサビリティ）
};

/** 機種エントリ → 配信用スペックJSONオブジェクト */
export function toSpec(entry: CollectionEntry<'machines'>): MachineSpec {
  const d = entry.data;
  const spec: MachineSpec = {
    type: 'slolog.machine',
    v: 1,
    id: entry.id,
    name: d.name,
    maker: d.maker,
    ceiling: '',
    junzo: d.junzo,
    zone: '',
    released: d.released,
  };
  if (d.koyaku) spec.koyaku = d.koyaku;
  if (d.gen) spec.gen = d.gen;
  if (d.type) spec.machineType = d.type;
  if (d.cabinet) spec.cabinet = d.cabinet;
  if (d.modelName) spec.modelName = d.modelName;
  if (d.bonus) spec.bonus = d.bonus;
  if (d.payout) spec.payout = d.payout;
  // 現行アプリは bonus/payout を直接は読まないので、memo に畳んで機種メモへ出す。
  const notes = [
    d.type ? `タイプ ${d.type}` : '',
    d.cabinet ? `筐体 ${d.cabinet}` : '',
    d.bonus ? `ボーナス合成 ${d.bonus}` : '',
    d.payout ? `出玉率 ${d.payout}` : '',
    d.bonusPayout ? `ボーナス ${d.bonusPayout}` : '',
    d.complete ? 'コンプリート機能搭載' : '',
  ].filter(Boolean);
  if (notes.length) spec.memo = notes.join(' ／ ');
  if (d.source) spec.source = d.source;
  return spec;
}

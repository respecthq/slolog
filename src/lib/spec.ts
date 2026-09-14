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
  ceiling: string;
  junzo: string;
  zone: string;
  released: string;
  koyaku?: string;
  gen?: string;     // 号機区分（アプリの号機チップ）
  machineType?: string; // 実機のタイプ（ノーマル／AT など）。契約識別子 type とは別の項目（監査 F11）
  cabinet?: string; // 筐体
  bonus?: string;   // ボーナス合成確率（メーカー公表）
  payout?: string;  // 出玉率＝機械割（メーカー公表）
  ceilingBonus?: string; // 天井恩恵
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
    ceiling: d.ceiling,
    junzo: d.junzo,
    zone: d.zone,
    released: d.released,
  };
  if (d.koyaku) spec.koyaku = d.koyaku;
  if (d.gen) spec.gen = d.gen;
  if (d.type) spec.machineType = d.type;
  if (d.cabinet) spec.cabinet = d.cabinet;
  if (d.ceilingBonus) spec.ceilingBonus = d.ceilingBonus;
  if (d.bonus) spec.bonus = d.bonus;
  if (d.payout) spec.payout = d.payout;
  // 現行アプリは bonus/payout を直接は読まないので、memo に畳んで機種メモへ出す
  const notes = [
    d.type ? `タイプ ${d.type}` : '',
    d.cabinet ? `筐体 ${d.cabinet}` : '',
    d.bonus ? `ボーナス合成 ${d.bonus}` : '',
    d.payout ? `出玉率 ${d.payout}` : '',
    d.ceilingBonus ? `天井恩恵 ${d.ceilingBonus}` : '',
    d.resetBehavior ? `設定変更時 ${d.resetBehavior}` : '',
    // 利用規約 第2条「出典を明示します」に合わせ、メーカー非公表の項目は確認元も一緒に送る
    d.verified ? `天井の確認: ${d.verified.by.join('・')}（${d.verified.date}時点・メーカー非公表）` : '',
  ].filter(Boolean);
  if (notes.length) spec.memo = notes.join(' ／ ');
  if (d.source) spec.source = d.source;
  return spec;
}

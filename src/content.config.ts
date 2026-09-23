import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// 許諾済み画像をpublic配下に置く。未登録なら画像枠は出さない。
const machineImage = z.object({
  src: z.string().regex(/^images\/[\p{L}\p{N}_./ -]+\.(?:png|jpe?g|webp|avif)$/iu, '画像は images/ から始まるローカル画像パスを指定してください'),
  alt: z.string().trim().min(1, '画像の代替テキストを記入してください'),
  placement: z.enum(['above', 'background']).default('above'),
  credit: z.string().trim().optional(),
}).superRefine((image, ctx) => {
  if (image.src.split('/').includes('..') || !existsSync(resolve('public', image.src))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['src'], message: 'public配下に画像がありません。パスを確認してください' });
  }
});

// 出典に使えない配信元（攻略・解析メディア）。
// これらの数値は「編集部調べ」＝各メディアの成果物で、メーカー公表事実ではない。
// 利用規約 第2条「当方が解析値や攻略情報を提供することはありません」と矛盾するので、
// 出典に入れた時点でビルドを落とす（出典なしを落とすのと同じ扱い）。
// 掲載許諾を得た場合はここから外し、notes/MAKER_PERMISSIONS.md（非公開） に記録すること。
const BLOCKED_SOURCE_HOSTS = [
  // 出版社・法人運営（掲載許諾の交渉相手になりうる。許諾が取れたらここから外す）
  'hisshobon.jp', 'hisshobon.com',        // 辰巳出版
  'p-gabu.jp', 'guideworks.co.jp',        // サミーネットワークス × ガイドワークス
  'd-deltanet.com', 'site777.jp',         // ダイコク電機（データロボ サイトセブン）
  '1geki.jp',                             // 株式会社一撃
  'p-town.dmm.com', 'pachinkovillage.jp', 'pachiseven.jp', 'nana-press.com',
  // 個人・小規模運営とみられるもの
  'chonborisuta.com', 'chonborista.com', 'slopachi-quest.com', 'ana-slo.com',
  'sokuho.info', 'slorepo.com', 'a-slot.net', 'pachi-slo.net', 'nanapachi.com',
  '6ki.jp', 'kachi-slo.com', 'amuse-p.com', 'kaku6.jp', 'altema.jp',
  'slobase.jp', 'pachinkovista.com', 'yancha-press.com', 'flick7.net',
  'slogati.com', 'enaiki.com', 'itikatu.jp', 'dechau.com', 'man-soft.com',
  'kenslo65536.com', 'juggler7.com', 'note.com',
];

// URL項目は「空」か「https:// ＋ ホスト名」だけ受ける（javascript:・不正なURL・平文httpを配信しない：監査 F12）
const httpsUrl = (label: string) =>
  z.coerce.string().default('').refine((v) => {
    if (v.trim() === '') return true;
    try {
      const u = new URL(v.trim());
      return u.protocol === 'https:' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname);
    } catch {
      return false;
    }
  }, { message: `${label}は https:// で始まる正しいURLを指定してください` });

const isBlockedSource = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_SOURCE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
};

// 無クオートの日付はYAMLがDateになるので文字列(YYYY-MM-DD)へ正規化する共通変換
const dateish = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim()));

// 機種スペック（メーカー公表事実のみ）。1機種＝1 markdown（frontmatter＋本文メモ）。
// このフォルダ（src/content/machines）を Obsidian の vault にすれば、md執筆→push→自動デプロイ。
const machines = defineCollection({
  // 機種mdだけ読む。_ 始まりのフォルダ/ファイル（日記・下書き）は無視＝ビルドが壊れない安全網
  loader: glob({ pattern: ['**/*.md', '!**/_*/**', '!**/_*.md'], base: './src/content/machines' }),
  schema: z.object({
    name: z.string(), // 機種名（必須）
    maker: z.coerce.string().default(''), // メーカー
    ceiling: z.coerce.string().default(''), // 天井（例：1480G / モード別）※数値でも可
    junzo: z.coerce.string().default(''), // 純増（例：7.0枚/G）
    zone: z.coerce.string().default(''), // ゾーン
    // 導入日 YYYY-MM-DD／メーカーが月までしか公表していない場合は YYYY-MM
    released: dateish
      .refine((v) => v === '' || /^\d{4}-\d{2}(?:-\d{2})?$/.test(v), {
        message: '導入日は YYYY-MM または YYYY-MM-DD 形式で入力してください',
      })
      .default(''),
    koyaku: z.coerce.string().default(''), // 小役ロール（カウンター用・任意・カンマ区切り）
    // 基本情報（メーカー公式の記載）
    type: z.coerce.string().default(''),    // タイプ（例 ノーマル／AT／ボーナストリガー）
    gen: z.coerce.string().default(''),     // 分類・号機（例 6号機（スマスロ））※アプリの号機チップに入る
    cabinet: z.coerce.string().default(''), // 筐体（例 アーチャー）
    modelName: z.coerce.string().default(''), // 型式名（公安委員会の検定公示に載る正式名。例 SマイジャグラーVI KK）
    modelNameSource: z.coerce.string().default(''), // 型式名を確認したページ（検定公示を転記している媒体のURL。ページには出さない）
    kenteiNo: z.coerce.string().default(''), // 検定番号（公示の識別子。ページには出さない・照合用）
    // 設定別スペック（メーカー公式が公表している場合のみ）。範囲で持つ：設定1〜6
    bonus: z.coerce.string().default(''),  // ボーナス合成確率（例 1/163.8〜1/114.6）
    payout: z.coerce.string().default(''), // 出玉率＝機械割（例 97.0%〜109.4%）
    // 天井まわり（どのメーカーも非公表。法人2媒体で一致を確認したものだけ載せる）
    ceilingBonus: z.coerce.string().default(''),  // 天井恩恵
    resetBehavior: z.coerce.string().default(''), // 設定変更・電源OFF/ON時の挙動
    noCeiling: z.boolean().default(false),        // 天井が仕様上存在しない（ノーマルAタイプ等）
    // 確認元。ceiling/zone/ceilingBonus/resetBehavior に値を入れるなら必須
    verified: z.object({
      by: z.array(z.string().trim().min(1)).min(1), // 表示する確認元（例 ['777パチガブ']）
      url: httpsUrl('確認元URL'),                    // 代表URL（任意）
      date: dateish,                                // 確認日
      crosscheck: httpsUrl('照合URL'),               // 照合に使った2件目のURL（QA用・ページには出さない）
    }).optional(),
    image: machineImage.optional(), // 許諾済み筐体画像。上部／タイトル背景を選べる
    // 出典・トレーサビリティ（メーカー公表事実の裏取り。出典明示にもなる）
    source: httpsUrl('出典URL'), // 出典URL（メーカー公式/ニュース）
    fetched: dateish.default(''), // 取得日 YYYY-MM-DD
    bonusPayout: z.coerce.string().default(''), // ボーナスの終了条件・獲得枚数（メーカー公表。例 BIG 266枚超の払い出しで終了）
    seller: z.coerce.string().default(''), // 販売元（製造元と違うときだけ。例：サミー・平和・SANKYO）
    brand: z.coerce.string().default(''), // 業界での表記＝P-WORLD・DMMぱちタウンの「メーカー」欄（販売元のことも製造元のこともある）。一覧・ページ見出し・アプリのメーカー欄に使う
    specSource: httpsUrl('スペックの出典URL'), // 設定別スペックが載っているメーカーのページ（source と別のとき。ページの出典に並べる）
    newsSource: httpsUrl('業界紙URL'), // 導入日・製造元・型式名を確かめた業界紙の記事（ページの出典に並べる。アプリには出さない）
    // 更新履歴（ホームの新着ブロック用。一覧の並び順は導入日のままにする）
    crosscheckUrl: httpsUrl('照合URL'), // 転記ミス検出の照合先（verified が無い機種用・非表示）
    // 情報が増えたかを見張る追加のページ（製品ページなど。scripts/watch-sources.mjs が読む・ページには出さない）
    watch: z.array(z.string().url()).default([]),
    watchKeyword: z.coerce.string().default(''), // 2 媒体を検索するときの語（省略時は機種名の先頭の語）
    added: dateish.default(''),       // LPに載せた日
    updated: dateish.default(''),     // 最後に内容を更新した日（任意）
    updateNote: z.coerce.string().default(''), // 新着に出す一言（例 天井・ゾーンを追加）
    draft: z.boolean().default(false), // 下書きは配信しない
    // 自社のオリジナル機（回胴キナナ）。実機ではないので出典が存在しない。
    // サイトには「架空機」と明示して載せるが、アプリ配信用のJSONには入れない
    // （アプリはサンプルとして同じ機種を内蔵しており、取り込むと二重になる）。
    fictional: z.boolean().default(false),
  }).refine(
    // 2026-09-23〜 天井・ゾーンは扱わない（メーカー非公表の解析値で、条件の注釈を漏らすとクレームになるため）。実機には入れさせない
    (d) => d.fictional || !(d.ceiling || d.zone || d.ceilingBonus || d.resetBehavior || d.noCeiling || d.verified),
    {
      // メーカー非公表の項目は、確認元と確認日を持たずに配信させない。
      // 詳細は PIPELINE.md「どこから取るか」と SOURCES.md。
      message: '天井・ゾーン・天井恩恵・設定変更時・天井なし・確認元（verified）は扱いません（2026-09-23 決定）。架空機以外では空にしてください',
      path: ['verified'],
    },
  ).refine((d) => d.draft || d.fictional || d.source.trim() !== '', {
    // 「出典と取得日を明示」がハブの原則。出典の無い機種は draft のままにする。
    // ルーティンが自動で draft を外すようになっても、出典なしでは絶対に配信されない安全網
    message: '出典（source）が無い機種は draft: true のままにしてください（配信するには出典URLが必要。自社のオリジナル機は fictional: true）',
    path: ['source'],
  }).refine((d) => !isBlockedSource(d.source), {
    // 攻略・解析メディアを出典にしない（詳細は SOURCES.md）
    message: '攻略・解析メディアは出典にできません。メーカー公表（公式サイト・公式リリース・公式SNS/動画・メディア登録で提供された資料）を出典にしてください',
    path: ['source'],
  }),
});

export const collections = { machines };

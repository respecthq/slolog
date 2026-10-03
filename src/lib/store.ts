// App Store の公開URL（2026-09-19 公開）。国を固定しない形にして、開いた人の地域のストアへ飛ばす
// 2026-10-03〜 App Store Connect のキャンペーンリンク（ct=lp）。LP 経由のダウンロードを App Analytics で数える
export const APP_STORE_URL = 'https://apps.apple.com/app/apple-store/id6810979308?pt=128663518&ct=lp&mt=8';
export const APP_STORE_URL_JP = 'https://apps.apple.com/jp/app/apple-store/id6810979308?pt=128663518&ct=lp&mt=8';

// 機種ページの「スロログで開く」（slolog://open/import?id=…）。
// 受け口はアプリ 1.0.2 から（2026-09-25 公開を確認して true に）
// （古い版で押しても何も起きないボタンになるため）。true にしたら npm run build → push。
export const DEEPLINK_ENABLED = true;
export const deepLinkFor = (id: string) => `slolog://open/import?id=${encodeURIComponent(id)}`;

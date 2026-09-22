// App Store の公開URL（2026-09-19 公開）。国を固定しない形にして、開いた人の地域のストアへ飛ばす
export const APP_STORE_URL = 'https://apps.apple.com/app/id6810979308';
export const APP_STORE_URL_JP = 'https://apps.apple.com/jp/app/id6810979308';

// 機種ページの「スロログで開く」（slolog://open/import?id=…）。
// 受け口はアプリ 1.0.2 から。**1.0.2 が App Store で公開されるまで false のまま**にする
// （古い版で押しても何も起きないボタンになるため）。true にしたら npm run build → push。
export const DEEPLINK_ENABLED = false;
export const deepLinkFor = (id: string) => `slolog://open/import?id=${encodeURIComponent(id)}`;

// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages（respecthq/slolog）で配信する。サブパス配信なので base が要る。
// アプリ側が同じURLを直書きしているので、ここを変えるときは必ず一緒に変える：
//   slolog/lib/data/links.dart      kLpBaseUrl
//   slolog/lib/data/persistence.dart kMachinesUrl
//   slolog/lib/data/pickup.dart      kPickupUrl
// 別の配信先を試すときは環境変数で上書きできる（SITE_ORIGIN / SITE_BASE）。
export default defineConfig({
  site: process.env.SITE_ORIGIN || 'https://respecthq.github.io',
  base: process.env.SITE_BASE || '/slolog',
  trailingSlash: 'ignore',
});

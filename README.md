# slolog-lp

スロログの LP ／ 機種スペックハブ（Astro・静的サイト）。
機種スペックを **静的JSONで配信** して、スロログアプリの「機種を取り込む」と同期する。

## 使い方

```bash
cd ~/slolog-lp
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ に静的出力（そのままデプロイ）
```

## 構成

```
src/
├── content.config.ts          機種コレクションのスキーマ（slolog.machine の元）
├── content/machines/*.md       ← 機種md（ここを Obsidian の vault にする）
├── lib/spec.ts                 機種 → slolog.machine JSON 変換（アプリ契約の一元定義）
├── layouts/Base.astro          共通レイアウト（キナナ配色）
└── pages/
    ├── index.astro             LPトップ
    ├── machines/index.astro    機種一覧
    ├── machines/[slug].astro   機種詳細（「アプリに登録用JSONをコピー」ボタン）
    ├── machines/[slug].json.ts 単体スペックJSON（/machines/xxx.json）
    └── machines.json.ts        全機種JSON（/machines.json）
```

## アプリ同期（LP↔アプリの契約）

機種は `slolog.machine` 型のJSONで受け渡す（アプリ側 `lib/data/machine_spec.dart` と対）：

```json
{ "type": "slolog.machine", "v": 1, "name": "…", "maker": "…",
  "ceiling": "1480G", "junzo": "7.0枚/G", "zone": "…",
  "released": "2024-04-15", "koyaku": "チェリー,スイカ" }
```

- **v1（インフラ不要）**：機種ページの「アプリに登録用JSONをコピー」→ スロログに貼り付け。
- **v2（UX最良）**：アプリが `/machines/xxx.json` を取得。`/machines.json` で全件一覧も配信。

※メーカー公表事実のみ。**狙い目/ヤメ時・期待値は含めない**（各自がアプリの「期待値メモ」で入力）。
出典として使える範囲は [SOURCES.md](SOURCES.md)、メーカーの許諾状況は `notes/MAKER_PERMISSIONS.md`（非公開・git管理外）。

## 記事を書く（Obsidian）

`src/content/machines/` を Obsidian の vault フォルダにすると、md執筆がそのまま機種ページになる。
Obsidian の Git プラグインで push → デプロイ先（Cloudflare Pages / Netlify 等）が自動ビルド。

新しい機種：`src/content/machines/xxx.md` を追加（frontmatter：name / maker / ceiling / junzo / zone / released / koyaku）。`draft: true` は配信しない。

## デプロイ

静的出力なので Cloudflare Pages / Netlify / Vercel いずれも可（ビルド `npm run build`・出力 `dist`）。
本番ドメインが決まったら `astro.config.mjs` の `site` を差し替え。

import type { APIRoute } from 'astro';

// 「今日の注目機種」フィード（アプリのホームに出るカード）。/pickup.json
//
// アプリ側は取得できなければセクションごと非表示にするので、
// 出すものが無いときは空配列を返しておけばよい（404でも動くが、
// 空配列を返した方が「配信は生きている」ことが分かる）。
//
// カード1枚の形（表記ゆれには寛容だが、この形が正）：
//   { "machine": "スマスロ北斗の拳", "title": "新台", "date": "2026/9/1",
//     "badge": "NEW", "note": "天井1000G / 有利区間引継ぎ" }
// type:"vote" にすると RE:PLAY 復活希望投票のようなカードとして混ぜられる。
export const GET: APIRoute = async () => {
  const pickups: unknown[] = [];
  return new Response(JSON.stringify(pickups, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

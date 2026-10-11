// 機種mdの本文に生HTML・危険なリンクが無いことをビルド前に確認する（監査 F12）。
// Astro の Markdown は生HTMLをそのまま通すので、原稿レビューの抜けや外部原稿の取り込みで
// <img onerror=…> や javascript: リンクが公開ページに乗らないよう、ここで落とす。
// 許可：fetch-kitadenshi が入れる <!-- spec:begin --> / <!-- spec:end --> のコメントだけ。
//
// 2026-10-12 監査で見直し：
//   ・調べるファイルを公開対象（content.config.ts の glob と同じ：サブフォルダも含む・_ 始まりは除く）とそろえる
//   ・正規表現で行を見るのをやめ、Markdown を構文木にして調べる（参照形式のリンク [a][x] / [x]: javascript:…、
//     文字参照 &#106;avascript: などのすり抜けを、パーサーが解いた後の URL で判定する）
//   ・リンク・画像の URL は https: と、ページ内（#）・サイト内（/）だけ許す
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

const root = 'src/content/machines';

// 公開対象と同じ選び方：サブフォルダも含む .md。パスのどこかが _ で始まるものは除く
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const SPEC_COMMENT = /^<!--\s*spec:(begin|end)\s*-->$/;

/** リンク・画像の URL として許すか（パーサーが文字参照・参照形式を解いた後の値で見る） */
function safeUrl(url) {
  const u = String(url ?? '').trim();
  if (u === '') return true;
  // 制御文字・空白を挟んだ「java\tscript:」なども、ここで弾く
  if (/[\u0000-\u001f\u007f\s]/.test(u)) return false;
  if (u.startsWith('#')) return true; // ページ内
  if (u.startsWith('/') && !u.startsWith('//')) return true; // サイト内（// は別ホストなので不可）
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false; // 相対パス（foo.html）や読めない URL は使わない
  }
}

const files = walk(root);
const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  // frontmatter（--- で囲んだ先頭）を外して本文だけ
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = m ? text.slice(m[0].length) : text;
  const offset = m ? m[0].split('\n').length - 1 : 0;
  const tree = fromMarkdown(body);
  const where = (node) => `${relative('.', file)}:${(node.position?.start.line ?? 0) + offset}`;
  visit(tree, (node) => {
    if (node.type === 'html') {
      if (!SPEC_COMMENT.test(node.value.trim())) problems.push(`${where(node)}  生HTMLは使えません: ${node.value.trim().slice(0, 60)}`);
    }
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      if (!safeUrl(node.url)) problems.push(`${where(node)}  使えないリンク（https:// か / か # だけ）: ${String(node.url).slice(0, 60)}`);
    }
  });
}
if (problems.length) {
  console.error('✗ 機種本文のチェックに失敗しました:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`✓ 機種本文 ${files.length} 件：生HTML・危険リンクなし`);

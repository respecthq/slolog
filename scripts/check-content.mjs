// 機種mdの本文に生HTML・危険なリンクが無いことをビルド前に確認する（監査 F12）。
// Astro の Markdown は生HTMLをそのまま通すので、原稿レビューの抜けや外部原稿の取り込みで
// <img onerror=…> や javascript: リンクが公開ページに乗らないよう、ここで落とす。
// 許可：fetch-kitadenshi が入れる <!-- spec:begin --> / <!-- spec:end --> のコメントだけ。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/machines';
const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
const problems = [];
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  const parts = text.split('---');
  const body = parts.slice(2).join('---');
  const lines = body.split('\n');
  lines.forEach((line, i) => {
    const n = i + 1;
    const stripped = line.replace(/<!--\s*spec:(begin|end)\s*-->/g, '');
    if (/<\s*[a-zA-Z!/?]/.test(stripped)) problems.push(`${f}:${n}  生HTMLは使えません: ${line.trim().slice(0, 60)}`);
    if (/\]\(\s*(javascript|data|vbscript):/i.test(stripped)) problems.push(`${f}:${n}  危険なリンク: ${line.trim().slice(0, 60)}`);
    if (/\]\(\s*http:\/\//i.test(stripped)) problems.push(`${f}:${n}  リンクは https:// にしてください: ${line.trim().slice(0, 60)}`);
  });
}
if (problems.length) {
  console.error('✗ 機種本文のチェックに失敗しました:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`✓ 機種本文 ${files.length} 件：生HTML・危険リンクなし`);

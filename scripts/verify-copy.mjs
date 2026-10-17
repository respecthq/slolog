// npm run build 後、LPの製品説明とアプリ側の法的本文の整合を確認する。
// 描画や実機ディープリンクの確認は別途必要。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {parse} from 'parse5';
import {PRIVACY, TERMS} from '../src/lib/legal.ts';

const root = path.resolve(import.meta.dirname, '..');
const walk = (node, fn) => { fn(node); node.childNodes?.forEach(n => walk(n, fn)); };
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const find = (node, predicate) => { const found = []; walk(node, n => { if (predicate(n)) found.push(n); }); return found; };
const byId = (node, id) => find(node, n => attr(n, 'id') === id)[0];
const home = parse(await fs.readFile(path.join(root, 'dist/index.html'), 'utf8'));
const app = await fs.readFile(path.join(root, 'public/editorial/app.js'), 'utf8');
const source = app.match(/const content = (\{[\s\S]*?\n\});/);
assert(source, 'Feature tab copy missing');
const features = vm.runInNewContext(`(${source[1]})`, Object.create(null));
assert.equal(text(byId(home, 'feature-label')), features.ev.label);
assert.equal(text(byId(home, 'feature-title')), features.ev.title.replaceAll('\n', ''));
assert.equal(text(byId(home, 'feature-description')), features.ev.description);
assert.deepEqual(find(byId(home, 'feature-list'), n => n.tagName === 'li').map(text), Array.from(features.ev.list));
assert.equal(attr(byId(home, 'feature-image'), 'alt'), features.ev.alt);
// トップでは6問を表示し、残りは「ほかの質問も見る」の中（#faq-more）に置く。合計11問は変えない
assert.equal(find(byId(home, 'faq'), n => n.tagName === 'details').length, 11);
assert.equal(find(byId(home, 'faq-more'), n => n.tagName === 'details').length, 5);
assert.equal(find(byId(home, 'faq'), n => n.tagName === 'details' && attr(n, 'open') !== undefined).length, 0);
const pro = find(home, n => attr(n, 'class')?.split(' ').includes('pro') && n.tagName === 'article')[0];
assert.deepEqual(find(pro, n => n.tagName === 'strong').map(text), ['自分の機種の期待値表', 'マイボーダー検証', '期待値と実戦値', '自分の小役確率で設定推測', '共有画像のロゴを非表示']);
// トップの「まずは、一日分から。」は外した（2026-10 トップ改修）。サンプルの案内はサポートページの「操作を試すには」に残す
const support = parse(await fs.readFile(path.join(root, 'dist/support/index.html'), 'utf8'));
assert.match(text(byId(support, 'start').parentNode), /サンプルを入れる/);
assert.doesNotMatch(text(home), /分析はぜんぶ無料|設定判別できます|Proを App Storeで試す|年額2か月お得/);

const machines = JSON.parse(await fs.readFile(path.join(root, 'dist/machines.json'), 'utf8'));
let counters = 0;
for (const machine of machines) {
  const data = JSON.parse(await fs.readFile(path.join(root, `dist/machines/${machine.id}.json`), 'utf8'));
  const html = parse(await fs.readFile(path.join(root, `dist/machines/${machine.id}/index.html`), 'utf8'));
  const hasCounter = Boolean(data.settei?.counter?.length);
  assert.equal(text(html).includes('専用カウンタ・設定推測に対応'), hasCounter, machine.id);
  if (hasCounter) counters++;
}

const appLegalPath = process.argv[2] || path.resolve(root, '../slolog/lib/data/legal_text.dart');
const appLegal = await fs.readFile(appLegalPath, 'utf8');
for (const [name, source] of [['kPrivacyPolicy', PRIVACY], ['kTermsOfUse', TERMS]]) {
  const match = appLegal.match(new RegExp(`const String ${name} = '''([\\s\\S]*?)''';`));
  assert(match, name);
  assert.equal(match[1].trim(), source.trim(), `App / LP legal copy differs: ${name}`);
}
console.log(`PASS: 3 feature tabs, initial copy parity, 11 FAQs, 5 Pro features, sample guide, ${counters} conditional counter panels, App / LP legal parity.`);

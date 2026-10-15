import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { counterRolesSchema } from '../src/lib/counter-schema.ts';
import { toSpec } from '../src/lib/spec.ts';

const entry = (data = {}) => ({
  id: 'test-machine',
  data: { name: 'テスト機種', maker: 'メーカー', ceiling: '', junzo: '', released: '', ...data },
});

test('天井なしは明示的な true だけを配信する', () => {
  assert.equal(toSpec(entry({ noCeiling: true })).noCeiling, true);
  assert.equal(toSpec(entry({ noCeiling: true })).ceiling, '');
});

test('空欄・未掲載・ノーマルというタイプだけで天井なしにしない', () => {
  for (const data of [{}, { noCeiling: false }, { type: 'ノーマル' }, { gen: '6号機' }]) {
    assert.equal(toSpec(entry(data)).noCeiling, false);
  }
});

test('天井数値は従来どおり配信せず、false は天井ありの保証として使わない', () => {
  const spec = toSpec(entry({ ceiling: '999G', noCeiling: false }));
  assert.equal(spec.ceiling, '');
  assert.equal(spec.noCeiling, false);
  assert.equal(spec.type, 'slolog.machine');
  assert.equal(spec.v, 1);
});

const readMachine = (slug) => {
  const parsed = parseFrontmatter(readFileSync(new URL(`../src/content/machines/${slug}.md`, import.meta.url), 'utf8'));
  return { id: slug, data: parsed.frontmatter, body: parsed.content };
};
const role = (name, kind, group = 'bonus') => ({ name, kind, group });

test('数える役は counter ひとつだけ。確率は公表BIG・REGのまま', () => {
  for (const slug of ['crea-bonus-trigger', 'mrjuggler', 'kerotto5bt', 'shake-bonus-trigger', 'matador3']) {
    const spec = toSpec(readMachine(slug));
    assert.ok(spec.settei, slug);
    assert.deepEqual(spec.settei.roles.map((r) => r.kind), ['big_total', 'reg_total'], slug);
    assert.equal('counter2' in spec.settei, false, slug);
    assert.equal('v2' in spec.settei, false, slug);
    assert.ok(counterRolesSchema.safeParse(spec.settei.counter).success, slug);
    assert.ok(spec.settei.count.length <= 120, slug);
    for (const r of spec.settei.counter) assert.deepEqual(Object.keys(r).sort(), ['group', 'kind', 'name'], slug);
  }
});

test('クレアはBIG・REGだけ、ミスターはBIG・REG・ぶどう', () => {
  assert.deepEqual(toSpec(readMachine('crea-bonus-trigger')).settei.counter, [role('BIG', 'big_total'), role('REG', 'reg_total')]);
  assert.deepEqual(toSpec(readMachine('mrjuggler')).settei.counter, [role('BIG', 'big_total'), role('REG', 'reg_total'), role('ぶどう', 'grape')]);
});

test('ケロットは同色・異色を分けた8項目。合算BIGのボタンは重ねない', () => {
  const settei = toSpec(readMachine('kerotto5bt')).settei;
  assert.deepEqual(settei.counter, [
    role('SBIG（同色）', 'big_same'), role('BIG（異色）', 'big_mixed'), role('REG', 'reg_total'),
    role('ベル', 'bell', 'koyaku'), role('チェリー', 'cherry_total', 'koyaku'), role('確定役', 'kakutei', 'koyaku'),
    role('平行オレンジ', 'orange_flat', 'koyaku'), role('斜めオレンジ', 'orange_diag', 'koyaku'),
  ]);
  assert.match(settei.count, /SBIG（同色）とBIG（異色）は分けて/);
});

test('SHAKEは5項目。A・B合算は旧kindの確率を読み替えない', () => {
  const settei = toSpec(readMachine('shake-bonus-trigger')).settei;
  assert.deepEqual(settei.settings, [1, 2, 5, 6]);
  assert.deepEqual(settei.counter.map((r) => r.kind), ['big_total', 'reg_total', 'bell_ab', 'cherry_total', 'suika_ab']);
  assert.match(settei.count, /A・B合算/);
});

test('マタドールのBT中GはBT突入回数と区別し、btグループを使う', () => {
  const settei = toSpec(readMachine('matador3')).settei;
  assert.deepEqual(settei.counter.at(-1), role('BT中1枚役', 'bt_one', 'bt'));
  assert.match(settei.count, /BIG前半と後半の間/);
  assert.match(settei.count, /BT突入回数ではありません/);
});

test('不正な役・名前や種類の重複・同じ組の重なりは配信前に拒否', () => {
  const base = [role('BIG', 'big_total'), role('REG', 'reg_total')];
  for (const roles of [
    [...base, role('BIG', 'grape')],
    [...base, role(' BIG ', 'grape')],
    [...base, role('BB', 'big_total')],
    [...base, role('同色', 'big_same', 'koyaku')],
    [...base, role('チェリー', 'cherry_total')],
    [role('チェリー', 'cherry_total', 'koyaku'), role('単独チェリー', 'cherry_solo', 'koyaku')],
    [role('', 'bell')], [role('x'.repeat(31), 'bell')],
    [role('ベル', 'bad kind')], [role('ベル', 'bell', 'other')],
    [{ ...role('ベル', 'bell'), denoms: [6, 5] }],
    Array.from({ length: 17 }, (_, i) => role(`役${i}`, `kind_${i}`, 'koyaku')),
  ]) assert.equal(counterRolesSchema.safeParse(roles).success, false, JSON.stringify(roles));
  assert.ok(counterRolesSchema.safeParse([...base, role('チェリー', 'cherry_total', 'koyaku')]).success, '別の組は近似として許容');
});

test('既存の全機種のカウンタも役定義の制約に適合する', () => {
  for (const filename of readdirSync(new URL('../src/content/machines/', import.meta.url))) {
    if (!filename.endsWith('.md') || filename.startsWith('_')) continue;
    const { data } = readMachine(filename.slice(0, -3));
    if (!data.counter) continue;
    assert.ok(counterRolesSchema.safeParse(data.counter.roles ?? []).success, filename);
    assert.ok(!data.counter.count || data.counter.count.length <= 120, filename);
    assert.equal('v2' in data.counter, false, filename);
  }
});

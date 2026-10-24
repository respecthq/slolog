import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { counterRolesSchema, counterRolesV2Schema, counterV2Schema } from '../src/lib/counter-schema.ts';
import { toSpec } from '../src/lib/spec.ts';
import { counterFrontmatterLines } from './counter-frontmatter.mjs';

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

test('旧counterは維持し、配信する確率は公表BIG・REGのまま', () => {
  for (const slug of ['crea-bonus-trigger', 'mrjuggler', 'kerotto5bt', 'shake-bonus-trigger', 'matador3']) {
    const spec = toSpec(readMachine(slug));
    assert.ok(spec.settei, slug);
    assert.deepEqual(spec.settei.roles.map((r) => r.kind), ['big_total', 'reg_total'], slug);
    assert.equal('counter2' in spec.settei, slug === 'shake-bonus-trigger', slug);
    assert.equal('v2' in spec.settei, false, slug);
    assert.ok(counterRolesSchema.safeParse(spec.settei.counter).success, slug);
    assert.ok(spec.settei.count.length <= 120, slug);
    for (const r of spec.settei.counter) assert.deepEqual(Object.keys(r).sort(), ['group', 'kind', 'name'], slug);
  }
});

test('クレアはBIG・REGだけ、ミスターはBIG・REG・ブドウ', () => {
  assert.deepEqual(toSpec(readMachine('crea-bonus-trigger')).settei.counter, [role('BIG', 'big_total'), role('REG', 'reg_total')]);
  assert.deepEqual(toSpec(readMachine('mrjuggler')).settei.counter, [role('BIG', 'big_total'), role('REG', 'reg_total'), role('ブドウ', 'grape')]);
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

test('SHAKEの旧counterは5項目。A・B合算は旧kindの確率を読み替えない', () => {
  const settei = toSpec(readMachine('shake-bonus-trigger')).settei;
  assert.deepEqual(settei.settings, [1, 2, 5, 6]);
  assert.deepEqual(settei.counter.map((r) => r.kind), ['big_total', 'reg_total', 'bell_ab', 'cherry_total', 'suika_ab']);
  assert.match(settei.count, /A・B合算/);
});

test('SHAKEのcounter2だけが7項目。新項目は確率なしの内訳として配信', () => {
  const machine = readMachine('shake-bonus-trigger');
  const spec = toSpec(machine);
  const settei = spec.settei;
  assert.deepEqual(settei.counter2, [
    ...settei.counter,
    role('スイカ＋ナディアBIG', 'trig_big_suika', 'trigger_big'),
    role('ベル＋REG', 'trig_reg_bell', 'trigger_reg'),
  ]);
  assert.ok(counterRolesV2Schema.safeParse(settei.counter2).success);
  assert.ok(counterV2Schema.safeParse(machine.data.counter.v2).success);
  assert.match(settei.count2, /自動加算されません/);
  assert.match(settei.count2, /途中から数えた内訳は推測に使わない/);
  assert.ok(settei.count2.length <= 120);
  for (const r of settei.counter2) assert.deepEqual(Object.keys(r).sort(), ['group', 'kind', 'name']);
  // 追加キーを無視する1.2.0が読む値は、v2未定義時と完全に同じ。
  const legacyMachine = structuredClone(machine);
  delete legacyMachine.data.counter.v2;
  const legacySpec = structuredClone(spec);
  delete legacySpec.settei.counter2;
  delete legacySpec.settei.count2;
  assert.deepEqual(legacySpec, toSpec(legacyMachine));
  assert.equal(counterRolesSchema.safeParse(settei.counter2).success, false);
});

test('新内訳はkind/groupと合計の定義が揃ったときだけ受け付ける', () => {
  const valid = toSpec(readMachine('shake-bonus-trigger')).settei.counter2;
  for (const roles of [
    valid.map((r) => r.kind === 'trig_big_suika' ? { ...r, group: 'bonus' } : r),
    valid.map((r) => r.kind === 'trig_reg_bell' ? { ...r, group: 'trigger_big' } : r),
    valid.map((r) => r.kind === 'trig_reg_bell' ? { ...r, kind: 'unknown_trigger' } : r),
    valid.map((r) => r.kind === 'trig_reg_bell' ? { ...r, kind: 'trig_future', group: 'koyaku' } : r),
    valid.filter((r) => r.kind !== 'big_total'),
    valid.filter((r) => r.kind !== 'reg_total'),
    valid.filter((r) => r.kind !== 'suika_ab'),
    valid.filter((r) => r.kind !== 'bell_ab'),
    valid.map((r) => r.kind === 'bell_ab' ? { ...r, group: 'bt' } : r),
    valid.map((r) => r.kind === 'big_total' ? { ...r, group: 'koyaku' } : r),
    valid.map((r) => r.kind === 'trig_big_suika' ? { ...r, denoms: [100, 90, 80, 70] } : r),
    [...valid, { ...valid.at(-1), name: '別名' }],
  ]) assert.equal(counterRolesV2Schema.safeParse(roles).success, false, JSON.stringify(roles));
  for (const v2 of [
    { roles: valid, count: '' },
    { roles: valid, count: 'x'.repeat(121) },
    { roles: valid, count: '通常時', probabilities: [1, 2] },
    { roles: [], count: '通常時' },
  ]) assert.equal(counterV2Schema.safeParse(v2).success, false, JSON.stringify(v2));
});

test('将来の役追加でもBIG・REGそれぞれの内訳は1項目までに制限する', () => {
  const valid = toSpec(readMachine('shake-bonus-trigger')).settei.counter2;
  assert.ok(counterRolesV2Schema.safeParse(valid).success, 'BIGとREGに1項目ずつなら使える');
  for (const group of ['trigger_big', 'trigger_reg']) {
    const extra = role('将来の別契機', group === 'trigger_big' ? 'trig_big_future' : 'trig_reg_future', group);
    const result = counterRolesV2Schema.safeParse([...valid, extra]);
    assert.equal(result.success, false, group);
    // 未知のkindの拒否だけに依存しない。将来そのkindが登録されてもこの制限を残す。
    assert.ok(result.error.issues.some((issue) => issue.message === `counter.roles の ${group} は1項目までです（同じボーナスの複数内訳は未対応）`), group);
  }
});

test('LPの更新ツールは旧counterだけの更新でv2を消さない', () => {
  const previous = readMachine('shake-bonus-trigger').data.counter;
  const change = { ...previous, note: '更新メモ: "内訳"\n合計は別に数える' };
  delete change.v2;
  const render = (data, old = previous) => parseFrontmatter(`---\n${counterFrontmatterLines(data, '2026-10-24', old).join('\n')}\n---\n`).frontmatter.counter;
  const updated = render(change);
  assert.deepEqual(updated.v2, previous.v2);
  assert.deepEqual(updated.roles, previous.roles);
  assert.equal(updated.note, change.note);
  const explicit = { roles: previous.v2.roles, count: '通常時に数える' };
  assert.deepEqual(render({ ...change, v2: explicit }).v2, explicit);
  assert.equal('v2' in render(change, {}), false);
  assert.throws(() => render({ ...change, v2: null }));
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
    assert.equal('v2' in data.counter, filename === 'shake-bonus-trigger.md', filename);
    if (data.counter.v2) assert.ok(counterV2Schema.safeParse(data.counter.v2).success, filename);
  }
});

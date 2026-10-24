// lp-apply が旧counterだけを更新しても、新アプリ向けの定義を黙って消さない。
const quote = (value) => JSON.stringify(String(value));
export function counterFrontmatterLines(change, date, previous = {}) {
  const lines = [
    'counter: # 機種専用の小役カウンタ（設定判別）：unchecked 未確認／none 対象外／bonus BIG・REGだけ／detail 小役も数える',
    `  status: ${change.status}`,
    `  date: ${change.date ?? date}`,
  ];
  if (change.checked?.length) lines.push('  checked:', ...change.checked.map((u) => `    - ${quote(u)}`));
  if (change.note) lines.push(`  note: ${quote(change.note)}`);
  if (change.count) lines.push(`  count: ${quote(change.count)}`);
  const addRoles = (roles, indent) => {
    if (roles?.length) lines.push(`${indent}roles:`, ...roles.map((r) => `${indent}  - { name: ${quote(r.name)}, kind: ${quote(r.kind)}, group: ${quote(r.group)} }`));
  };
  addRoles(change.roles, '  ');
  const v2 = Object.hasOwn(change, 'v2') ? change.v2 : previous.v2;
  if (v2 !== undefined) {
    if (!v2 || !Array.isArray(v2.roles) || typeof v2.count !== 'string') {
      throw new Error('counter.v2 は roles と count を指定してください。旧counterの更新だけでは削除しません');
    }
    lines.push('  v2:', `    count: ${quote(v2.count)}`);
    addRoles(v2.roles, '    ');
  }
  return lines;
}

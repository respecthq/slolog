import { z } from 'astro/zod';

// lib/data/settei.dart と同じ役定義の制約。数値は持たず、数え方だけを配る。
const counterRoleSchema = z.object({
  name: z.string().trim().min(1).max(30),
  kind: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
  group: z.enum(['bonus', 'koyaku', 'bt']),
}).strict();

const conflicts = [
  ['big_total', 'big_solo'], ['big_total', 'big_cherry'],
  ['reg_total', 'reg_solo'], ['reg_total', 'reg_cherry'],
  ['big_total', 'big_pierrot'], ['reg_total', 'reg_pierrot'],
  ['cherry_total', 'cherry_solo'], ['cherry_total', 'big_cherry'],
  ['cherry_total', 'reg_cherry'], ['cherry_total', 'big_total'],
  ['cherry_total', 'reg_total'],
] as const;

export const counterRolesSchema = z.array(counterRoleSchema).max(16).superRefine((roles, ctx) => {
  const names = roles.map((r) => r.name);
  const kinds = roles.map((r) => r.kind);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: 'counter.roles の name が重なっています' });
  if (new Set(kinds).size !== kinds.length) ctx.addIssue({ code: 'custom', message: 'counter.roles の kind が重なっています' });
  for (const bonus of ['big', 'reg']) {
    const total = `${bonus}_total`;
    if (kinds.includes(total) && kinds.some((k) => k.startsWith(`${bonus}_`) && k !== total)) {
      ctx.addIssue({ code: 'custom', message: 'BIG・REG は全体か内訳のどちらか一方で数えてください（同じボーナスを二重に数えない）' });
    }
  }
  for (const group of ['bonus', 'koyaku', 'bt']) {
    const grouped = new Set(roles.filter((r) => r.group === group).map((r) => r.kind));
    for (const [a, b] of conflicts) {
      if (grouped.has(a) && grouped.has(b)) {
        ctx.addIssue({ code: 'custom', message: `counter.roles の ${a} と ${b} は同じゲームで重なるので、同じ group に入れられません` });
      }
    }
  }
});

import { z } from 'astro/zod';

// lib/data/settei.dart と同じ役定義の制約。数値は持たず、数え方だけを配る。
const counterRoleSchema = z.object({
  name: z.string().trim().min(1).max(30),
  kind: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
  group: z.enum(['bonus', 'koyaku', 'bt']),
}).strict();

const counterRoleV2Schema = counterRoleSchema.extend({
  group: z.enum(['bonus', 'koyaku', 'bt', 'trigger_big', 'trigger_reg']),
});

const triggers = {
  trig_big_suika: { group: 'trigger_big', parent: 'big_total', small: 'suika_ab' },
  trig_reg_bell: { group: 'trigger_reg', parent: 'reg_total', small: 'bell_ab' },
} as const;

const conflicts = [
  ['big_total', 'big_solo'], ['big_total', 'big_cherry'],
  ['reg_total', 'reg_solo'], ['reg_total', 'reg_cherry'],
  ['big_total', 'big_pierrot'], ['reg_total', 'reg_pierrot'],
  ['cherry_total', 'cherry_solo'], ['cherry_total', 'big_cherry'],
  ['cherry_total', 'reg_cherry'], ['cherry_total', 'big_total'],
  ['cherry_total', 'reg_total'],
] as const;

type Role = z.infer<typeof counterRoleV2Schema>;
const validateRoles = (roles: Role[], ctx: z.RefinementCtx) => {
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
  // 現在の条件付き二項分布は、BIG/REGそれぞれの内訳が1項目のときだけ使える。
  // 役の種類を増やす際も、同じ親の複数内訳を独立に掛けないよう明示的に止める。
  for (const group of ['trigger_big', 'trigger_reg']) {
    if (roles.filter((r) => r.group === group).length > 1) {
      ctx.addIssue({ code: 'custom', message: `counter.roles の ${group} は1項目までです（同じボーナスの複数内訳は未対応）` });
    }
  }
  for (const role of roles) {
    const trigger = Object.hasOwn(triggers, role.kind) ? triggers[role.kind as keyof typeof triggers] : undefined;
    if (trigger) {
      if (role.group !== trigger.group) ctx.addIssue({ code: 'custom', message: `${role.kind} の group は ${trigger.group} にしてください` });
      for (const [kind, group] of [[trigger.parent, 'bonus'], [trigger.small, 'koyaku']]) {
        if (!roles.some((r) => r.kind === kind && r.group === group)) {
          ctx.addIssue({ code: 'custom', message: `${role.kind} には ${kind}（${group}）の合計ボタンが必要です` });
        }
      }
    } else if (role.kind.startsWith('trig_') || role.group === 'trigger_big' || role.group === 'trigger_reg') {
      ctx.addIssue({ code: 'custom', message: `未対応のボーナス内訳 ${role.kind} は配信できません` });
    }
  }
};

// 1.2.0 向け counter は従来の3グループだけ。新しい組を混ぜると旧アプリが定義全体を拒否する。
export const counterRolesSchema = z.array(counterRoleSchema).max(16).superRefine(validateRoles);
export const counterRolesV2Schema = z.array(counterRoleV2Schema).min(2).max(16).superRefine(validateRoles);
export const counterV2Schema = z.object({
  roles: counterRolesV2Schema,
  count: z.string().trim().min(1).max(120),
}).strict().superRefine((counter, ctx) => {
  if (!counter.roles.some((r) => r.kind.startsWith('big_')) || !counter.roles.some((r) => r.kind.startsWith('reg_'))) {
    ctx.addIssue({ code: 'custom', message: 'counter.v2.roles に BIG と REG を入れてください' });
  }
});

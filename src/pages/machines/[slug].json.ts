import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { toSpec } from '../../lib/spec';

// 単体スペックJSON（アプリ同期v2＝ID指定で取得）。例: /machines/bancho4.json
export async function getStaticPaths() {
  const machines = await getCollection('machines', ({ data }) => !data.draft && !data.fictional);
  return machines.map((m) => ({ params: { slug: m.id }, props: { m } }));
}

export const GET: APIRoute = ({ props }) => {
  const spec = toSpec(props.m);
  return new Response(JSON.stringify(spec, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

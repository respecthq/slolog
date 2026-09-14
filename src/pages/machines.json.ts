import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { toSpec } from '../lib/spec';

// 全機種スペックJSON（アプリの一覧同期用）。/machines.json
export const GET: APIRoute = async () => {
  const machines = await getCollection('machines', ({ data }) => !data.draft && !data.fictional);
  const body = machines
    .sort((a, b) => (b.data.released ?? '').localeCompare(a.data.released ?? ''))
    .map(toSpec);
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
